-- Persist the per-device community worker state required by unified-voice.
-- Worker mode is enabled by the signed-in ChatWork app; only verified, downloaded
-- model adapters are published as routing capabilities.
alter table public.workly_ai_voice_devices
  add column if not exists worker_enabled boolean not null default false,
  add column if not exists model_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists worker_updated_at timestamptz;

create index if not exists workly_ai_voice_devices_worker_online_idx
  on public.workly_ai_voice_devices (last_seen_at desc)
  where revoked_at is null and worker_enabled = true;

comment on column public.workly_ai_voice_devices.worker_enabled is
  'Per-device community worker state. ChatWork enables it automatically after account pairing.';
comment on column public.workly_ai_voice_devices.model_capabilities is
  'ChatWork-reported ready model, task and language capabilities used for relay routing.';
