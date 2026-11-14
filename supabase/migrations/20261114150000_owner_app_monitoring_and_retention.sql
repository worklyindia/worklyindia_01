-- Owner-only app monitoring and 30-day installation retention.
create table if not exists public.app_installations (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'web',
  device_model text,
  os_version text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists app_installations_user_id_idx on public.app_installations(user_id);
create index if not exists app_installations_last_seen_idx on public.app_installations(last_seen_at desc);
alter table public.app_installations enable row level security;
drop policy if exists "Users register their own app installation" on public.app_installations;
create policy "Users register their own app installation" on public.app_installations
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update their own app installation" on public.app_installations;
create policy "Users update their own app installation" on public.app_installations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Owners read app installations" on public.app_installations;
create policy "Owners read app installations" on public.app_installations
  for select to authenticated using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'owner')
  );
revoke all on public.app_installations from anon;
grant select, insert, update on public.app_installations to authenticated;

drop policy if exists "Owners read app error reports" on public.app_error_reports;
create policy "Owners read app error reports" on public.app_error_reports
  for select to authenticated using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'owner')
  );
grant select on public.app_error_reports to authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'purge-workly-app-error-reports';
  perform cron.unschedule(jobid) from cron.job where jobname = 'purge-workly-app-installations';
exception when undefined_table then null;
end $$;
select cron.schedule(
  'purge-workly-app-error-reports',
  '15 3 * * *',
  $$delete from public.app_error_reports where created_at < now() - interval '30 days'$$
);
select cron.schedule(
  'purge-workly-app-installations',
  '30 3 * * *',
  $$delete from public.app_installations where last_seen_at < now() - interval '30 days'$$
);
