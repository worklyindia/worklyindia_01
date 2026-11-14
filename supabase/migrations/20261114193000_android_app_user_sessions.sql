-- Android app-only user sessions and Owner dashboard scoping.
-- Website/browser traffic is excluded by the native bridge gate in src/App.tsx.
create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  installation_id uuid not null references public.app_installations(installation_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android_app' check (platform = 'android_app'),
  device_model text not null default 'Android device',
  os_version text not null default 'Unknown',
  app_version text not null default 'Unknown',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint app_sessions_time_order check (last_seen_at >= started_at)
);

create index if not exists app_sessions_user_last_seen_idx
  on public.app_sessions(user_id, last_seen_at desc);
create index if not exists app_sessions_last_seen_idx
  on public.app_sessions(last_seen_at desc);
create index if not exists app_sessions_installation_idx
  on public.app_sessions(installation_id, started_at desc);

alter table public.app_sessions enable row level security;
drop policy if exists "Users read their own app sessions" on public.app_sessions;
create policy "Users read their own app sessions" on public.app_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create their own Android app sessions" on public.app_sessions;
create policy "Users create their own Android app sessions" on public.app_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and platform = 'android_app'
    and exists (
      select 1 from public.app_installations ai
      where ai.installation_id = app_sessions.installation_id
        and ai.user_id = (select auth.uid())
        and ai.platform = 'android_app'
    )
  );
drop policy if exists "Users update their own Android app sessions" on public.app_sessions;
create policy "Users update their own Android app sessions" on public.app_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and platform = 'android_app'
    and exists (
      select 1 from public.app_installations ai
      where ai.installation_id = app_sessions.installation_id
        and ai.user_id = (select auth.uid())
        and ai.platform = 'android_app'
    )
  );
drop policy if exists "Owners read Android app sessions" on public.app_sessions;
create policy "Owners read Android app sessions" on public.app_sessions
  for select to authenticated using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = (select auth.uid()) and au.role = 'owner'
    )
  );
revoke all on public.app_sessions from anon;
grant select, insert, update on public.app_sessions to authenticated;

-- Only users with an Android app installation belong in App User Details.
-- This prevents website-only accounts from appearing in the app dashboard.
create or replace function public.get_owner_app_user_details()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  full_name text,
  phone text,
  location text,
  city text,
  state text,
  profile_image_url text,
  account_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.role = 'owner'
  ) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text, u.created_at, p.full_name, p.phone,
         p.location, p.city, p.state, p.profile_image_url, p.account_status
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where exists (
    select 1 from public.app_installations ai
    where ai.user_id = u.id and ai.platform = 'android_app'
  )
  order by u.created_at desc;
end;
$$;
revoke all on function public.get_owner_app_user_details() from public, anon;
grant execute on function public.get_owner_app_user_details() to authenticated;

-- Keep inactive installation records long enough for the Owner to identify
-- returning and dormant app users. Session detail is retained for 90 days.
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname in ('purge-workly-app-installations', 'purge-workly-app-sessions');
exception when undefined_table then null;
end $$;
select cron.schedule(
  'purge-workly-app-installations',
  '30 3 * * *',
  $$delete from public.app_installations where last_seen_at < now() - interval '365 days'$$
);
select cron.schedule(
  'purge-workly-app-sessions',
  '45 3 * * *',
  $$delete from public.app_sessions where last_seen_at < now() - interval '90 days'$$
);
