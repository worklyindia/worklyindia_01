-- Make app telemetry writes RLS-enforced (no SECURITY DEFINER RPC).
-- Anonymous users may insert telemetry events only; they cannot read any rows.
create table if not exists public.app_anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  session_id uuid not null,
  installation_id uuid not null,
  event_type text not null check (event_type in ('heartbeat', 'end')),
  platform text not null default 'android_app' check (platform = 'android_app'),
  device_model text not null default 'Android device',
  os_version text not null default 'Unknown',
  app_version text not null default 'Unknown',
  created_at timestamptz not null default now()
);
create index if not exists app_anonymous_sessions_session_created_idx
  on public.app_anonymous_sessions(session_id, created_at desc);
create index if not exists app_anonymous_sessions_created_idx
  on public.app_anonymous_sessions(created_at desc);
alter table public.app_anonymous_sessions enable row level security;
drop policy if exists "Anonymous Android app sessions can be recorded" on public.app_anonymous_sessions;
create policy "Anonymous Android app sessions can be recorded"
  on public.app_anonymous_sessions for insert to anon
  with check (platform = 'android_app' and event_type in ('heartbeat', 'end'));
drop policy if exists "Owners read anonymous Android app sessions" on public.app_anonymous_sessions;
create policy "Owners read anonymous Android app sessions"
  on public.app_anonymous_sessions for select to authenticated
  using (exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid()) and au.role = 'owner'
  ));
revoke all on public.app_anonymous_sessions from anon, authenticated;
grant insert on public.app_anonymous_sessions to anon;
grant select on public.app_anonymous_sessions to authenticated;

drop policy if exists "Anonymous Android app installs can be registered" on public.app_anonymous_installations;
create policy "Anonymous Android app installs can be registered"
  on public.app_anonymous_installations for insert to anon with check (true);
grant insert on public.app_anonymous_installations to anon;

-- Restore authenticated-user-owned session writes. The caller cannot select or
-- mutate another user's rows; the Owner retains read-only visibility.
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
grant insert, update, select on public.app_sessions to authenticated;

drop function if exists public.record_android_app_session(uuid, uuid, text, text, text, boolean, uuid);

-- SECURITY INVOKER keeps all writes subject to the caller's RLS policies.
-- Authenticated callers write their own session; anonymous callers can only
-- append non-readable anonymous telemetry events.
create or replace function public.record_android_app_session(
  p_event_id uuid,
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
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_device text := left(coalesce(nullif(trim(p_device_model), ''), 'Android device'), 120);
  v_os text := left(coalesce(nullif(trim(p_os_version), ''), 'Unknown'), 80);
  v_app text := left(coalesce(nullif(trim(p_app_version), ''), 'Unknown'), 80);
begin
  if p_event_id is null or p_session_id is null or p_installation_id is null then
    raise exception 'Event, session and installation identifiers are required' using errcode = '22004';
  end if;

  if v_user_id is null then
    insert into public.app_anonymous_installations
      (installation_id, device_model, os_version, app_version)
    values (p_native_installation_id, v_device, v_os, v_app)
    on conflict (installation_id) do nothing;

    insert into public.app_anonymous_sessions
      (event_id, session_id, installation_id, event_type, platform, device_model, os_version, app_version)
    values
      (p_event_id, p_session_id, p_installation_id,
       case when p_end_session then 'end' else 'heartbeat' end,
       'android_app', v_device, v_os, v_app)
    on conflict (event_id) do nothing;
  else
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
        and app_sessions.user_id = excluded.user_id;
  end if;
end;
$$;

revoke all on function public.record_android_app_session(uuid, uuid, uuid, text, text, text, boolean, uuid) from public;
grant execute on function public.record_android_app_session(uuid, uuid, uuid, text, text, text, boolean, uuid) to anon, authenticated;
