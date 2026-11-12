create or replace function private.enforce_app_error_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recent_count integer;
begin
  if new.event_id is null or new.installation_id is null then
    raise exception 'event_id and installation_id are required';
  end if;

  if exists (
    select 1 from public.app_error_reports where event_id = new.event_id
  ) then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.installation_id::text, 90210)
  );

  select count(*)::integer
    into recent_count
    from public.app_error_reports
   where installation_id = new.installation_id
     and created_at >= now() - interval '1 hour';

  if recent_count >= 60 then
    raise exception using errcode = 'P0001', message = 'app_error_report_rate_limit_exceeded';
  end if;

  return new;
end;
$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'purge-workly-app-error-reports';
exception when undefined_table then
  null;
end $$;

select cron.schedule(
  'purge-workly-app-error-reports',
  '*/5 * * * *',
  $$delete from public.app_error_reports where created_at < now() - interval '24 hours'$$
);
