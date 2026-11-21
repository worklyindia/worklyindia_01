-- Store the latest Firebase registration token for the paired owner device.
-- The table remains service-role-only; clients can only update through the relay Edge Function.
alter table public.workly_ai_voice_devices
  add column if not exists fcm_token text,
  add column if not exists fcm_token_updated_at timestamptz;
