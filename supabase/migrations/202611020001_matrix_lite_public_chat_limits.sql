create table if not exists public.matrix_lite_rate_buckets (
  bucket_key text not null,
  period_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, period_start)
);

create index if not exists matrix_lite_rate_buckets_period_start_idx
  on public.matrix_lite_rate_buckets (period_start);

alter table public.matrix_lite_rate_buckets enable row level security;
revoke all on table public.matrix_lite_rate_buckets from public, anon, authenticated;
grant all on table public.matrix_lite_rate_buckets to service_role;

create or replace function public.matrix_lite_consume_request(p_ip_hash text)
returns table (
  allowed boolean,
  reason text,
  remaining_today integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := now();
  v_hour timestamptz := date_trunc('hour', timezone('UTC', now())) at time zone 'UTC';
  v_day timestamptz := date_trunc('day', timezone('UTC', now())) at time zone 'UTC';
  v_ip_hits integer;
  v_global_hits integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_ip_hash';
  end if;

  delete from public.matrix_lite_rate_buckets
  where period_start < v_now - interval '3 days';

  insert into public.matrix_lite_rate_buckets as buckets
    (bucket_key, period_start, hit_count, updated_at)
  values
    ('ip:' || p_ip_hash, v_hour, 1, v_now)
  on conflict (bucket_key, period_start)
  do update set
    hit_count = least(buckets.hit_count + 1, 11),
    updated_at = v_now
  returning hit_count into v_ip_hits;

  if v_ip_hits > 10 then
    select coalesce(b.hit_count, 0)
      into v_global_hits
      from public.matrix_lite_rate_buckets b
      where b.bucket_key = 'global' and b.period_start = v_day;

    return query
      select false, 'ip_limit'::text,
             greatest(0, 40 - coalesce(v_global_hits, 0)),
             v_hour + interval '1 hour';
    return;
  end if;

  insert into public.matrix_lite_rate_buckets as buckets
    (bucket_key, period_start, hit_count, updated_at)
  values
    ('global', v_day, 1, v_now)
  on conflict (bucket_key, period_start)
  do update set
    hit_count = least(buckets.hit_count + 1, 41),
    updated_at = v_now
  returning hit_count into v_global_hits;

  if v_global_hits > 40 then
    return query
      select false, 'daily_limit'::text, 0,
             v_day + interval '1 day';
    return;
  end if;

  return query
    select true, 'ok'::text, greatest(0, 40 - v_global_hits),
           v_day + interval '1 day';
end;
$function$;

revoke all on function public.matrix_lite_consume_request(text) from public, anon, authenticated;
grant execute on function public.matrix_lite_consume_request(text) to service_role;
