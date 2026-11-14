-- Count Android app launches even before a person signs in, without storing PII.
-- All writes go through a narrow RPC; raw anonymous table access remains denied.
alter table public.app_sessions alter column user_id drop not null;
alter table public.app_sessions drop constraint if exists app_sessions_installation_id_fkey;

create table if not exists public.app_anonymous_installations (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null unique,
  device_model text not null default 'Android device',
  os_version text not null default 'Unknown',
  app_version text not null default 'Unknown',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists app_anonymous_installations_last_seen_idx
  on public.app_anonymous_installations(last_seen_at desc);
alter table public.app_anonymous_installations enable row level security;
drop policy if exists "Owners read anonymous Android app installations" on public.app_anonymous_installations;
create policy "Owners read anonymous Android app installations"
  on public.app_anonymous_installations for select to authenticated
  using (exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid()) and au.role = 'owner'
  ));
revoke all on public.app_anonymous_installations from anon, authenticated;
grant select on public.app_anonymous_installations to authenticated;

-- The native WebView bridge gate is enforced in the app client. This RPC writes
-- only fixed android_app telemetry, derives user_id from the verified JWT, and
-- never accepts profile/contact/location data from the caller.
create or replace function public.record_android_app_session(
  p_session_id uuid,
  p_installation_id uuid,
  p_device_model text default 'Android device',
  p_os_version text default 'Unknown',
  p_app_version text default 'Unknown',
  p_end_session boolean default false,
  p_native_installation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_device text := left(coalesce(nullif(trim(p_device_model), ''), 'Android device'), 120);
  v_os text := left(coalesce(nullif(trim(p_os_version), ''), 'Unknown'), 80);
  v_app text := left(coalesce(nullif(trim(p_app_version), ''), 'Unknown'), 80);
begin
  if p_session_id is null or p_installation_id is null then
    raise exception 'Session and installation identifiers are required' using errcode = '22004';
  end if;

  if v_user_id is null then
    insert into public.app_anonymous_installations
      (installation_id, device_model, os_version, app_version, first_seen_at, last_seen_at)
    values (p_installation_id, v_device, v_os, v_app, now(), now())
    on conflict (installation_id) do update
      set device_model = excluded.device_model,
          os_version = excluded.os_version,
          app_version = excluded.app_version,
          last_seen_at = now();
  else
    if p_native_installation_id is not null then
      delete from public.app_anonymous_installations where installation_id = p_native_installation_id;
    end if;
    insert into public.app_installations
      (installation_id, user_id, platform, device_model, os_version, app_version, last_seen_at)
    values (p_installation_id, v_user_id, 'android_app', v_device, v_os, v_app, now())
    on conflict (installation_id) do update
      set user_id = excluded.user_id,
          platform = 'android_app',
          device_model = excluded.device_model,
          os_version = excluded.os_version,
          app_version = excluded.app_version,
          last_seen_at = now();
  end if;

  insert into public.app_sessions
    (session_id, installation_id, user_id, platform, device_model, os_version, app_version, started_at, last_seen_at, ended_at)
  values
    (p_session_id, p_installation_id, v_user_id, 'android_app', v_device, v_os, v_app, now(), now(),
     case when p_end_session then now() else null end)
  on conflict (session_id) do update
    set last_seen_at = now(),
        ended_at = case when p_end_session then now() else null end,
        device_model = excluded.device_model,
        os_version = excluded.os_version,
        app_version = excluded.app_version
    where app_sessions.installation_id = excluded.installation_id
      and app_sessions.user_id is not distinct from excluded.user_id;
end;
$$;

revoke all on function public.record_android_app_session(uuid, uuid, text, text, text, boolean, uuid) from public;
grant execute on function public.record_android_app_session(uuid, uuid, text, text, text, boolean, uuid) to anon, authenticated;

-- Direct table writes are no longer needed; the RPC owns session upserts.
drop policy if exists "Users create their own Android app sessions" on public.app_sessions;
drop policy if exists "Users update their own Android app sessions" on public.app_sessions;
revoke insert, update on public.app_sessions from anon, authenticated;
grant select on public.app_sessions to authenticated;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'purge-workly-anonymous-app-installations';
exception when undefined_table then null;
end $$;
select cron.schedule(
  'purge-workly-anonymous-app-installations',
  '35 3 * * *',
  $$delete from public.app_anonymous_installations where last_seen_at < now() - interval '365 days'$$
);
