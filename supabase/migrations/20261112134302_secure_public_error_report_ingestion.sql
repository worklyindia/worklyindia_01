create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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

revoke all on function private.enforce_app_error_report_rate_limit() from public, anon, authenticated;

drop trigger if exists app_error_reports_rate_limit on public.app_error_reports;
create trigger app_error_reports_rate_limit
before insert on public.app_error_reports
for each row execute function private.enforce_app_error_report_rate_limit();

drop policy if exists app_error_reports_public_insert on public.app_error_reports;
create policy app_error_reports_public_insert
on public.app_error_reports
for insert to anon, authenticated
with check (
  event_id is not null
  and installation_id is not null
  and char_length(component) between 1 and 80
  and severity in ('warning', 'error', 'fatal')
  and char_length(error_type) between 1 and 120
  and char_length(message) <= 1200
  and char_length(stack_trace) <= 10000
);

grant insert on public.app_error_reports to anon, authenticated;
revoke select, update, delete, truncate, references, trigger
on public.app_error_reports from anon, authenticated;
