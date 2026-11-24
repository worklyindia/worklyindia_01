-- ChatWork per-account worker scheduler, atomic claims, retries and recovery.
-- This migration follows 20261124120000_chatwork_worker_device_health_metrics.sql.

alter table public.workly_ai_voice_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists cleanup_completed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workly_ai_voice_jobs_attempt_count_check') then
    alter table public.workly_ai_voice_jobs
      add constraint workly_ai_voice_jobs_attempt_count_check
      check (attempt_count >= 0 and attempt_count <= 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workly_ai_voice_jobs_max_attempts_check') then
    alter table public.workly_ai_voice_jobs
      add constraint workly_ai_voice_jobs_max_attempts_check
      check (max_attempts between 1 and 5);
  end if;
end $$;

create index if not exists workly_ai_voice_jobs_owner_queue_idx
  on public.workly_ai_voice_jobs (user_id, status, created_at desc)
  where status in ('pending', 'running');
create index if not exists workly_ai_voice_jobs_running_started_idx
  on public.workly_ai_voice_jobs (started_at)
  where status = 'running';
create index if not exists workly_ai_voice_jobs_retry_due_idx
  on public.workly_ai_voice_jobs (next_attempt_at, created_at)
  where status = 'pending';
create index if not exists workly_ai_voice_devices_owner_worker_idx
  on public.workly_ai_voice_devices (user_id, worker_enabled, last_seen_at desc)
  where revoked_at is null;

-- One atomic claim per device poll. SKIP LOCKED prevents duplicate delivery
-- when multiple requests from the same phone arrive at the same time.
create or replace function public.claim_workly_voice_job(p_device_id uuid)
returns table (id uuid, job_type text, payload jsonb, expires_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with next_job as (
    select j.id
    from public.workly_ai_voice_jobs j
    join public.workly_ai_voice_devices d on d.id = j.device_id
    where j.device_id = p_device_id
      and j.status = 'pending'
      and j.expires_at > now()
      and (j.next_attempt_at is null or j.next_attempt_at <= now())
      and d.worker_enabled = true
      and d.revoked_at is null
    order by j.created_at asc
    limit 1
    for update of j skip locked
  )
  update public.workly_ai_voice_jobs j
  set status = 'running',
      started_at = now(),
      attempt_count = j.attempt_count + 1,
      next_attempt_at = null
  from next_job n
  where j.id = n.id
  returning j.id, j.job_type, j.payload, j.expires_at;
$$;

-- Retry only on another compatible phone owned by the same account. If no
-- alternate phone is online, leave the task queued for this phone to reconnect.
create or replace function public.retry_workly_voice_job(
  p_job_id uuid,
  p_device_id uuid,
  p_reason text
)
returns table (job_id uuid, status text, assigned_device_id uuid, attempt_count integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_job public.workly_ai_voice_jobs%rowtype;
  v_target_device uuid;
  v_language text;
  v_reason text := left(coalesce(p_reason, 'Worker reported a processing failure'), 500);
begin
  select * into v_job
  from public.workly_ai_voice_jobs
  where id = p_job_id
    and device_id = p_device_id
    and status = 'running'
  for update;

  if not found then
    return;
  end if;

  if v_job.attempt_count >= v_job.max_attempts then
    update public.workly_ai_voice_jobs
    set status = 'failed',
        result = jsonb_build_object('error', v_reason, 'retrying', false),
        completed_at = now(),
        next_attempt_at = null
    where id = v_job.id;
  else
    v_language := case
      when v_job.job_type = 'translate'
        then nullif(lower(coalesce(v_job.payload->>'source_language', '')) || '-' || lower(coalesce(v_job.payload->>'target_language', '')), '-')
      else nullif(lower(coalesce(v_job.payload->>'language', '')), '')
    end;

    select d.id into v_target_device
    from public.workly_ai_voice_devices d
    where d.user_id = v_job.user_id
      and d.worker_enabled = true
      and d.revoked_at is null
      and d.last_seen_at > now() - interval '60 seconds'
      and exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(d.model_capabilities) = 'array'
            then d.model_capabilities else '[]'::jsonb end
        ) cap
        where cap->>'task' = v_job.job_type
          and cap->>'model' = coalesce(v_job.model_id, '')
          and cap->>'ready' = 'true'
          and (
            v_language is null
            or exists (
              select 1
              from jsonb_array_elements_text(
                case when jsonb_typeof(cap->'languages') = 'array'
                  then cap->'languages' else '[]'::jsonb end
              ) lang(value)
              where lower(lang.value) = v_language
                or lower(lang.value) = 'multilingual'
                or (v_job.job_type <> 'translate'
                    and split_part(lower(lang.value), '-', 1) = split_part(v_language, '-', 1))
            )
          )
      )
    order by (d.id = p_device_id) asc,
      (select count(*) from public.workly_ai_voice_jobs active
        where active.device_id = d.id
          and active.status in ('pending', 'running')
          and active.expires_at > now()) asc,
      d.last_seen_at desc
    limit 1
    for update of d skip locked;

    if v_target_device is null then
      update public.workly_ai_voice_jobs
      set status = 'pending',
          started_at = null,
          next_attempt_at = now() + interval '30 seconds',
          result = jsonb_build_object('error', v_reason, 'retrying', true, 'waiting_for_worker', true)
      where id = v_job.id;
    else
      update public.workly_ai_voice_jobs
      set status = 'pending',
          device_id = v_target_device,
          started_at = null,
          next_attempt_at = now() + interval '3 seconds',
          result = jsonb_build_object('error', v_reason, 'retrying', true),
          completed_at = null
      where id = v_job.id;
    end if;
  end if;

  return query
  select j.id, j.status, j.device_id, j.attempt_count
  from public.workly_ai_voice_jobs j
  where j.id = v_job.id;
end;
$$;

-- Recover tasks only when their assigned phone is revoked, opted out or has
-- missed its heartbeat. Long-running work on a healthy phone is left alone.
create or replace function public.recover_workly_voice_jobs()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_recovered integer := 0;
  v_expired integer := 0;
begin
  for v_job in
    select j.id, j.device_id
    from public.workly_ai_voice_jobs j
    join public.workly_ai_voice_devices d on d.id = j.device_id
    where j.status = 'running'
      and j.expires_at > now()
      and j.started_at < now() - interval '90 seconds'
      and (
        d.revoked_at is not null
        or d.worker_enabled = false
        or d.last_seen_at is null
        or d.last_seen_at < now() - interval '75 seconds'
      )
    order by j.started_at asc
    limit 100
    for update of j skip locked
  loop
    perform public.retry_workly_voice_job(v_job.id, v_job.device_id, 'Worker heartbeat lost; task automatically requeued');
    v_recovered := v_recovered + 1;
  end loop;

  with expired as (
    update public.workly_ai_voice_jobs
    set status = 'expired',
        completed_at = coalesce(completed_at, now()),
        next_attempt_at = null,
        result = case
          when result is null or result = '{}'::jsonb
            then jsonb_build_object('error', 'Job expired before a worker completed it')
          else result || jsonb_build_object('expired', true)
        end
    where status in ('pending', 'running')
      and expires_at <= now()
    returning id
  )
  select count(*)::integer into v_expired from expired;

  return v_recovered + v_expired;
end;
$$;

revoke all on function public.claim_workly_voice_job(uuid) from public, anon, authenticated;
revoke all on function public.retry_workly_voice_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.recover_workly_voice_jobs() from public, anon, authenticated, service_role;
grant execute on function public.claim_workly_voice_job(uuid) to service_role;
grant execute on function public.retry_workly_voice_job(uuid, uuid, text) to service_role;

comment on function public.claim_workly_voice_job(uuid) is
  'Atomic ChatWork job claim. Callable only by the service-role relay after device-token authentication.';
comment on function public.retry_workly_voice_job(uuid, uuid, text) is
  'Retries a failed ChatWork task only on a compatible phone belonging to the same user account.';
comment on function public.recover_workly_voice_jobs() is
  'Scheduled recovery for jobs whose assigned worker has gone offline; preserves account ownership.';

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'chatwork-worker-job-recovery'
  limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'chatwork-worker-job-recovery',
    '* * * * *',
    'select public.recover_workly_voice_jobs();'
  );
end $$;
