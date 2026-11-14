-- Avoid anonymous ON CONFLICT SELECT checks: use unique-violation handling
-- so anon needs insert-only privileges and never needs a SELECT policy.
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
  if p_event_id is null or p_session_id is null or p_installation_id is null or p_native_installation_id is null then
    raise exception 'Event, session and installation identifiers are required' using errcode = '22004';
  end if;

  if v_user_id is null then
    begin
      insert into public.app_anonymous_installations
        (installation_id, device_model, os_version, app_version)
      values (p_native_installation_id, v_device, v_os, v_app);
    exception when unique_violation then
      null;
    end;

    begin
      insert into public.app_anonymous_sessions
        (event_id, session_id, installation_id, event_type, platform, device_model, os_version, app_version)
      values
        (p_event_id, p_session_id, p_installation_id,
         case when p_end_session then 'end' else 'heartbeat' end,
         'android_app', v_device, v_os, v_app);
    exception when unique_violation then
      null;
    end;
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
revoke select on public.app_anonymous_installations from anon;
revoke select on public.app_anonymous_sessions from anon;
