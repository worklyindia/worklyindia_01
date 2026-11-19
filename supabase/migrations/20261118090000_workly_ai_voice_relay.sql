-- Workly AI Voice relay (isolated from existing Workly application tables).
-- This migration is committed for review only; it is NOT applied to the live Supabase project by this PR.


create table if not exists public.workly_ai_voice_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  device_name text not null default 'Workly AI Voice Android',
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists workly_ai_voice_devices_user_active_idx
  on public.workly_ai_voice_devices (user_id, created_at desc)
  where revoked_at is null;

create table if not exists public.workly_ai_voice_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.workly_ai_voice_devices(id) on delete cascade,
  job_type text not null check (job_type in ('tts', 'stt')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists workly_ai_voice_jobs_device_queue_idx
  on public.workly_ai_voice_jobs (device_id, status, created_at);

alter table public.workly_ai_voice_devices enable row level security;
alter table public.workly_ai_voice_jobs enable row level security;

revoke all on table public.workly_ai_voice_devices, public.workly_ai_voice_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.workly_ai_voice_devices, public.workly_ai_voice_jobs to service_role;
