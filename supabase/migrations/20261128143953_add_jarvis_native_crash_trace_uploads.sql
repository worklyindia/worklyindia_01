-- Store original Android native tombstones separately from the bounded crash summary.
-- Anonymous clients may insert bounded traces; only authenticated Workly owners may read them.
create table if not exists public.app_error_report_native_traces (
  event_id uuid primary key references public.app_error_reports(event_id) on delete cascade,
  installation_id uuid not null,
  app_version text not null,
  device_model text not null,
  trace_format text not null default 'android-native-tombstone-gzip-base64'
    check (trace_format = 'android-native-tombstone-gzip-base64'),
  trace_bytes integer not null check (trace_bytes > 0 and trace_bytes <= 4194304),
  trace_gzip_base64 text not null check (char_length(trace_gzip_base64) between 1 and 1800000),
  created_at timestamptz not null default now()
);

alter table public.app_error_report_native_traces enable row level security;
revoke all on public.app_error_report_native_traces from anon, authenticated;
grant insert on public.app_error_report_native_traces to anon, authenticated;
grant select on public.app_error_report_native_traces to authenticated;

create policy "Public can upload bounded native crash traces"
  on public.app_error_report_native_traces
  for insert to anon, authenticated
  with check (
    event_id is not null
    and installation_id is not null
    and char_length(app_version) between 1 and 80
    and char_length(device_model) between 1 and 120
    and trace_bytes between 1 and 4194304
    and char_length(trace_gzip_base64) between 1 and 1800000
  );

create policy "Owners can view native crash traces"
  on public.app_error_report_native_traces
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = (select auth.uid()) and au.role = 'owner'
    )
  );
