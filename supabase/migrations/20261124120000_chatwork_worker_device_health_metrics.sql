-- Store periodic resource telemetry reported by each authenticated ChatWork worker phone.
-- Metrics are allowlisted and validated in the device-authenticated relay before storage.
alter table public.workly_ai_voice_devices
  add column if not exists worker_metrics jsonb not null default '{}'::jsonb,
  add column if not exists metrics_updated_at timestamptz;

comment on column public.workly_ai_voice_devices.worker_metrics is
  'Sanitized device telemetry: internal storage, available RAM, battery level/status and temperature.';
comment on column public.workly_ai_voice_devices.metrics_updated_at is
  'Server timestamp of the most recent accepted device resource snapshot.';
