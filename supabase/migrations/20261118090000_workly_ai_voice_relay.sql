-- Workly AI Voice relay (isolated from existing Workly application tables).
-- This migration is committed for review only; it is NOT applied to the live Supabase project by this PR.

create schema if not exists workly_ai_private;
revoke all on schema workly_ai_private from public, anon, authenticated;
grant usage on schema workly_ai_private to service_role;

create table if not exists workly_ai_private.voice_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voice_pairings_expiry_idx
  on workly_ai_private.voice_pairings (expires_at);

create table if not exists workly_ai_private.voice_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  device_name text not null default 'Workly AI Voice Android',
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voice_devices_user_active_idx
  on workly_ai_private.voice_devices (user_id, created_at desc)
  where revoked_at is null;

create table if not exists workly_ai_private.voice_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references workly_ai_private.voice_devices(id) on delete cascade,
  job_type text not null check (job_type in ('tts', 'stt')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 minutes')
);

create index if not exists voice_jobs_device_queue_idx
  on workly_ai_private.voice_jobs (device_id, status, created_at);

alter table workly_ai_private.voice_pairings enable row level security;
alter table workly_ai_private.voice_devices enable row level security;
alter table workly_ai_private.voice_jobs enable row level security;

revoke all on all tables in schema workly_ai_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema workly_ai_private to service_role;
alter default privileges in schema workly_ai_private
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema workly_ai_private
  grant select, insert, update, delete on tables to service_role;
