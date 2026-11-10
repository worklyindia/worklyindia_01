
-- Performance: add missing indexes on hot lookup columns to relieve CPU spikes
CREATE INDEX IF NOT EXISTS idx_device_info_canvas_updated
  ON public.device_info_logs (canvas_fingerprint, updated_at DESC)
  WHERE canvas_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_device_info_fingerprint_hash_updated
  ON public.device_info_logs (fingerprint_hash, updated_at DESC)
  WHERE fingerprint_hash IS NOT NULL;

-- Home trust badges: hot ORDER BY sort_order WHERE is_active
CREATE INDEX IF NOT EXISTS idx_home_trust_badges_active_sort
  ON public.home_trust_badges (is_active, sort_order)
  WHERE is_active = true;

-- Jobs: covers status='active' AND visibility='public' ORDER BY trending_score DESC
CREATE INDEX IF NOT EXISTS idx_jobs_active_public_trending
  ON public.jobs (trending_score DESC)
  WHERE status = 'active' AND visibility = 'public';

ANALYZE public.device_info_logs;
ANALYZE public.home_trust_badges;
ANALYZE public.jobs;
