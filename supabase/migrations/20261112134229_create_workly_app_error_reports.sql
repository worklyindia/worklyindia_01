create table if not exists public.app_error_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  installation_id uuid not null,
  app_version text not null default 'unknown',
  android_version text not null default 'unknown',
  device_model text not null default 'unknown',
  component text not null,
  severity text not null check (severity in ('warning','error','fatal')),
  error_type text not null,
  message text not null default '',
  stack_trace text not null default '',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint app_error_reports_message_length check (char_length(message) <= 1200),
  constraint app_error_reports_stack_length check (char_length(stack_trace) <= 10000)
);

create index if not exists app_error_reports_created_at_idx
  on public.app_error_reports (created_at desc);
create index if not exists app_error_reports_installation_created_idx
  on public.app_error_reports (installation_id, created_at desc);

alter table public.app_error_reports enable row level security;
revoke all on table public.app_error_reports from anon, authenticated;
grant all on table public.app_error_reports to service_role;

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
  '*/15 * * * *',
  $$delete from public.app_error_reports where created_at < now() - interval '24 hours'$$
);
