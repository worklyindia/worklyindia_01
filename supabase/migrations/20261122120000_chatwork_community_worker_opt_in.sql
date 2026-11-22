-- Community ChatWork worker opt-in and model capability metadata.
-- Review-only migration: do not apply to production until the PR is approved.
alter table public.workly_ai_voice_devices
  add column if not exists worker_enabled boolean not null default false,
  add column if not exists model_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists worker_updated_at timestamptz;

create index if not exists workly_ai_voice_devices_worker_online_idx
  on public.workly_ai_voice_devices (last_seen_at desc)
  where revoked_at is null and worker_enabled = true;

comment on column public.workly_ai_voice_devices.worker_enabled is
  'Explicit per-device opt-in. Defaults OFF; only opted-in devices may receive community jobs.';
comment on column public.workly_ai_voice_devices.model_capabilities is
  'Client-reported model/task/language capabilities. Server treats this as routing metadata, never as proof that model files are safe or verified.';
