-- Make job_id nullable to allow profile view tracking
ALTER TABLE public.job_interactions 
ALTER COLUMN job_id DROP NOT NULL;

-- Add performance indexes for profile view queries
CREATE INDEX IF NOT EXISTS idx_job_interactions_profile_views 
ON public.job_interactions (interaction_type, ((metadata->>'profile_user_id'))) 
WHERE interaction_type = 'profile_view';

CREATE INDEX IF NOT EXISTS idx_job_interactions_created_at 
ON public.job_interactions (created_at DESC);