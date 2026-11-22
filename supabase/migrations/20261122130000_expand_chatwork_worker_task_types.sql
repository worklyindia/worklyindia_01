-- Expand the isolated ChatWork worker queue to the full planned task set.
-- This changes only the relay job_type constraint; it does not mark any model ready.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.workly_ai_voice_jobs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%job_type%'
  loop
    execute format('alter table public.workly_ai_voice_jobs drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.workly_ai_voice_jobs
  add constraint workly_ai_voice_jobs_job_type_check
  check (job_type in ('ai', 'stt', 'tts', 'translate', 'image', 'video'));

comment on column public.workly_ai_voice_jobs.job_type is
  'Task queue: ai, stt, tts, translate, image, video. A task is routable only when an opted-in online device advertises an exact ready model capability.';
