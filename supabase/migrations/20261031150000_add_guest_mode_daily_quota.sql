-- Guest access: anonymous users get a separate daily quota and never receive/spend CRD.
create or replace function public.handle_new_matrix_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data ->> 'display_name', '');
  insert into public.profiles(user_id, display_name) values (new.id, left(v_name, 48)) on conflict (user_id) do nothing;
  if coalesce(new.is_anonymous, false) then return new; end if;
  insert into public.credit_accounts(user_id, balance) values (new.id, 300) on conflict (user_id) do nothing;
  insert into public.credit_ledger(user_id, amount, reason) values (new.id, 300, 'welcome_grant') on conflict do nothing;
  return new;
end;
$$;

create or replace function public.matrix_reserve_chat_credit(p_user_id uuid, p_request_id uuid, p_model_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_balance integer; v_existing boolean; v_is_guest boolean;
  v_guest_day integer; v_global_day integer; v_global_minute integer; v_user_minute integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_allowed'; end if;
  if p_model_id not in ('liquid/lfm-2.5-2.6b:free','thinkingmachines/inkling-small:free') then raise exception 'model_not_allowed'; end if;
  select coalesce(is_anonymous, false) into v_is_guest from auth.users where id = p_user_id;
  if not found then raise exception 'user_not_found'; end if;
  perform pg_advisory_xact_lock(73492015);
  select exists(select 1 from public.matrix_usage_events where user_id=p_user_id and request_id=p_request_id) into v_existing;
  if v_existing then
    if v_is_guest then
      select count(*) into v_guest_day from public.matrix_usage_events where user_id=p_user_id and created_at > now()-interval '24 hours';
      return jsonb_build_object('reserved',false,'is_guest',true,'guest_remaining',greatest(0,10-v_guest_day));
    end if;
    select balance into v_balance from public.credit_accounts where user_id=p_user_id;
    return jsonb_build_object('reserved',false,'is_guest',false,'balance',v_balance);
  end if;
  select count(*) into v_global_day from public.matrix_usage_events where created_at > now()-interval '24 hours';
  if v_global_day >= 45 then raise exception 'shared_daily_limit'; end if;
  select count(*) into v_global_minute from public.matrix_usage_events where created_at > now()-interval '1 minute';
  if v_global_minute >= 15 then raise exception 'shared_rate_limit'; end if;
  select count(*) into v_user_minute from public.matrix_usage_events where user_id=p_user_id and created_at > now()-interval '1 minute';
  if v_user_minute >= 4 then raise exception 'user_rate_limit'; end if;
  if v_is_guest then
    select count(*) into v_guest_day from public.matrix_usage_events where user_id=p_user_id and created_at > now()-interval '24 hours';
    if v_guest_day >= 10 then raise exception 'guest_daily_limit'; end if;
    insert into public.matrix_usage_events(user_id,request_id,model_id) values(p_user_id,p_request_id,p_model_id);
    return jsonb_build_object('reserved',true,'is_guest',true,'guest_remaining',greatest(0,9-v_guest_day));
  end if;
  select balance into v_balance from public.credit_accounts where user_id=p_user_id for update;
  if v_balance is null then raise exception 'credit_account_missing'; end if;
  update public.credit_accounts set balance=balance-1,updated_at=now() where user_id=p_user_id and balance>=1 returning balance into v_balance;
  if v_balance is null then raise exception 'insufficient_credits'; end if;
  insert into public.credit_ledger(user_id,amount,reason,request_id,model_id) values(p_user_id,-1,'chat_charge',p_request_id,p_model_id);
  insert into public.matrix_usage_events(user_id,request_id,model_id) values(p_user_id,p_request_id,p_model_id);
  return jsonb_build_object('reserved',true,'is_guest',false,'balance',v_balance);
end;
$$;