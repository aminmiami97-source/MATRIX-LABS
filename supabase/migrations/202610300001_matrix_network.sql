create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 300 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('welcome_grant', 'chat_charge', 'chat_refund')),
  request_id uuid,
  model_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_one_welcome_grant
  on public.credit_ledger(user_id)
  where reason = 'welcome_grant';

create unique index if not exists credit_ledger_request_reason_once
  on public.credit_ledger(user_id, request_id, reason)
  where request_id is not null;

create table if not exists public.matrix_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  model_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

alter table public.profiles enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.matrix_usage_events enable row level security;

-- Client roles are read-only for account and credit data. The server-side
-- security-definer RPCs are the only supported path for credit mutations.
revoke all on table public.profiles, public.credit_accounts, public.credit_ledger
  from anon, authenticated;
grant select on table public.profiles, public.credit_accounts, public.credit_ledger
  to authenticated;
revoke all on table public.matrix_usage_events from anon, authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own credit account" on public.credit_accounts;
create policy "Users can read their own credit account"
  on public.credit_accounts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own credit ledger" on public.credit_ledger;
create policy "Users can read their own credit ledger"
  on public.credit_ledger for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_new_matrix_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data ->> 'display_name', '');

  insert into public.profiles(user_id, display_name)
  values (new.id, left(v_name, 48))
  on conflict (user_id) do nothing;

  insert into public.credit_accounts(user_id, balance)
  values (new.id, 300)
  on conflict (user_id) do nothing;

  insert into public.credit_ledger(user_id, amount, reason)
  values (new.id, 300, 'welcome_grant')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_matrix_auth_user_created on auth.users;
create trigger on_matrix_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_matrix_user();

create or replace function public.matrix_reserve_chat_credit(
  p_user_id uuid,
  p_request_id uuid,
  p_model_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_existing boolean;
  v_global_day integer;
  v_global_minute integer;
  v_user_day integer;
  v_user_minute integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not_allowed';
  end if;

  if p_model_id not in (
    'liquid/lfm-2.5-2.6b:free',
    'thinkingmachines/inkling-small:free'
  ) then
    raise exception 'model_not_allowed';
  end if;

  perform pg_advisory_xact_lock(73492015);

  select exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id
      and request_id = p_request_id
      and reason = 'chat_charge'
  ) into v_existing;

  select balance into v_balance
  from public.credit_accounts
  where user_id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'credit_account_missing';
  end if;

  if v_existing then
    return jsonb_build_object('reserved', false, 'balance', v_balance);
  end if;

  select count(*) into v_global_day
  from public.matrix_usage_events
  where created_at > now() - interval '24 hours';

  if v_global_day >= 45 then
    raise exception 'shared_daily_limit';
  end if;

  select count(*) into v_global_minute
  from public.matrix_usage_events
  where created_at > now() - interval '1 minute';

  if v_global_minute >= 15 then
    raise exception 'shared_rate_limit';
  end if;

  select count(*) into v_user_day
  from public.matrix_usage_events
  where user_id = p_user_id
    and created_at > now() - interval '24 hours';

  if v_user_day >= 10 then
    raise exception 'user_daily_limit';
  end if;

  select count(*) into v_user_minute
  from public.matrix_usage_events
  where user_id = p_user_id
    and created_at > now() - interval '1 minute';

  if v_user_minute >= 4 then
    raise exception 'user_rate_limit';
  end if;

  update public.credit_accounts
  set balance = balance - 1,
      updated_at = now()
  where user_id = p_user_id
    and balance >= 1
  returning balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger(user_id, amount, reason, request_id, model_id)
  values (p_user_id, -1, 'chat_charge', p_request_id, p_model_id);

  insert into public.matrix_usage_events(user_id, request_id, model_id)
  values (p_user_id, p_request_id, p_model_id);

  return jsonb_build_object('reserved', true, 'balance', v_balance);
end;
$$;

create or replace function public.matrix_refund_chat_credit(
  p_user_id uuid,
  p_request_id uuid,
  p_model_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_charged boolean;
  v_refunded boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not_allowed';
  end if;

  select exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and request_id = p_request_id and reason = 'chat_charge'
  ) into v_charged;

  if not v_charged then
    raise exception 'charge_not_found';
  end if;

  select exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and request_id = p_request_id and reason = 'chat_refund'
  ) into v_refunded;

  if v_refunded then
    select balance into v_balance
    from public.credit_accounts
    where user_id = p_user_id;
    return v_balance;
  end if;

  update public.credit_accounts
  set balance = balance + 1,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  insert into public.credit_ledger(user_id, amount, reason, request_id, model_id)
  values (p_user_id, 1, 'chat_refund', p_request_id, p_model_id);

  return v_balance;
end;
$$;

revoke all on function public.matrix_reserve_chat_credit(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.matrix_refund_chat_credit(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.matrix_reserve_chat_credit(uuid, uuid, text) to service_role;
grant execute on function public.matrix_refund_chat_credit(uuid, uuid, text) to service_role;
