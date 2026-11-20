-- Local ChatWork image generation through the owner's paired Android phone.
-- The phone runs Stable Diffusion locally; this migration only adds the secure relay/storage path.

alter table public.workly_ai_voice_jobs
  drop constraint if exists workly_ai_voice_jobs_job_type_check;

alter table public.workly_ai_voice_jobs
  add constraint workly_ai_voice_jobs_job_type_check
  check (job_type in ('tts', 'stt', 'ai', 'image'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workly-ai-images', 'workly-ai-images', false, 2097152, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg'];

-- Browser roles receive no direct bucket permissions. The relay Edge Function
-- uses the service role and returns short-lived signed URLs to the job owner.
