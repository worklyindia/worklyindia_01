-- Technical-only diagnostics from the ChatWork owner phone.
-- The Android client authenticates with its existing hashed device token through
-- the unified-voice Edge Function; no public Data API access is granted.
create table if not exists public.workly_ai_voice_diagnostics (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.workly_ai_voice_devices(id) on delete cascade,
  job_id uuid null references public.workly_ai_voice_jobs(id) on delete set null,
  event_type text not null check (event_type in (
    'relay_online','relay_error','model_warmup_failed',
    'tts_started','tts_synthesis_complete','tts_upload_complete','tts_failed'
  )),
  language text null,
  duration_ms bigint null check (duration_ms is null or duration_ms >= 0),
  audio_bytes bigint null check (audio_bytes is null or audio_bytes >= 0),
  error_type text null,
  error_message text null,
  app_version text null,
  android_version text null,
  device_model text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workly_ai_voice_diagnostics_device_created_idx
  on public.workly_ai_voice_diagnostics (device_id, created_at desc);
create index if not exists workly_ai_voice_diagnostics_job_idx
  on public.workly_ai_voice_diagnostics (job_id) where job_id is not null;
alter table public.workly_ai_voice_diagnostics enable row level security;
revoke all on table public.workly_ai_voice_diagnostics from public, anon, authenticated;
grant select, insert, update, delete on table public.workly_ai_voice_diagnostics to service_role;
