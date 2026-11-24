-- Store periodic resource telemetry reported by each authenticated ChatWork worker phone.
-- Metrics are allowlisted and validated in the device-authenticated relay before storage.
alter table public.workly_ai_voice_devices
  add column if not exists worker_metrics jsonb not null default '{}'::jsonb,
  add column if not exists metrics_updated_at timestamptz;

comment on column public.workly_ai_voice_devices.worker_metrics is
  'Sanitized device telemetry: internal storage, available RAM, battery level/status and temperature.';
comment on column public.workly_ai_voice_devices.metrics_updated_at is
  'Server timestamp of the most recent accepted device resource snapshot.';

-- These tables contain private account/device telemetry and diagnostics.
-- Keep RLS enabled with no direct anon/authenticated policies: access is only
-- through the authenticated relay, which resolves the owner from the device
-- token and applies explicit user_id/device_id filters to every dashboard query.
alter table public.workly_ai_voice_devices enable row level security;
alter table public.workly_ai_voice_jobs enable row level security;
alter table public.workly_ai_voice_diagnostics enable row level security;

comment on table public.workly_ai_voice_devices is
  'Private ChatWork device registry and telemetry. Do not add public or cross-account read policies.';
comment on table public.workly_ai_voice_jobs is
  'Private ChatWork jobs. Dashboard access must remain scoped to the authenticated owner.';
comment on table public.workly_ai_voice_diagnostics is
  'Private ChatWork diagnostics. Dashboard access must be scoped through owner device IDs.';
