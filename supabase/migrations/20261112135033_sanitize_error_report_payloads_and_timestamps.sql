create or replace function private.enforce_app_error_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recent_count integer;
  source_value text;
  status_value text;
begin
  if new.event_id is null or new.installation_id is null then
    raise exception 'event_id and installation_id are required';
  end if;

  new.created_at := now();

  new.message := left(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(new.message, ''), 'Bearer[[:space:]]+[A-Za-z0-9._~+/-]+=*', 'Bearer [REDACTED]', 'gi'),
        '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[EMAIL]', 'gi'
      ),
      '(https?://[^[:space:]?]+)\?[^[:space:]]+', '\1?[REDACTED]', 'gi'
    ),
    1200
  );
  new.stack_trace := left(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(new.stack_trace, ''), 'Bearer[[:space:]]+[A-Za-z0-9._~+/-]+=*', 'Bearer [REDACTED]', 'gi'),
        '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[EMAIL]', 'gi'
      ),
      '(https?://[^[:space:]?]+)\?[^[:space:]]+', '\1?[REDACTED]', 'gi'
    ),
    10000
  );

  if jsonb_typeof(coalesce(new.context, '{}'::jsonb)) <> 'object' then
    new.context := '{}'::jsonb;
  else
    source_value := left(regexp_replace(coalesce(new.context->>'source', ''), '\?.*$', '', 'g'), 120);
    status_value := new.context->>'http_status';
    new.context := jsonb_strip_nulls(jsonb_build_object(
      'source', nullif(source_value, ''),
      'http_status', case when status_value ~ '^\d{3}$' then status_value::integer else null end
    ));
  end if;

  if exists (select 1 from public.app_error_reports where event_id = new.event_id) then
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
  and jsonb_typeof(context) = 'object'
  and context - array['source', 'http_status'] = '{}'::jsonb
);
