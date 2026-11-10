
ALTER TABLE public.job_indexing_status
  ADD COLUMN IF NOT EXISTS is_paid_for_indexing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS indexing_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS indexing_payment_id text;

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('search_engine_indexing_price', '100', 'Price in INR to submit a job to Google & Bing search indexing')
ON CONFLICT (setting_key) DO NOTHING;

-- Cancel pending Google URL_UPDATED entries (paywall introduced)
UPDATE public.google_indexing_queue
   SET status = 'cancelled',
       error_message = COALESCE(error_message,'') || ' [cancelled: paywall]',
       processed_at = now()
 WHERE status = 'pending' AND action = 'URL_UPDATED';

-- Reset in-progress indexing rows (not yet public) back to queued+unpaid so UI shows paywall
UPDATE public.job_indexing_status
   SET google_status = 'queued',
       bing_status  = 'queued',
       google_scheduled_at = NULL,
       bing_scheduled_at   = NULL,
       is_paid_for_indexing = false
 WHERE COALESCE(is_google_public, false) = false
   AND COALESCE(is_bing_public,  false) = false;

-- Patch the existing trigger: only queue URL_UPDATED when paid; URL_DELETED path unchanged
CREATE OR REPLACE FUNCTION public.add_job_to_indexing_queue()
RETURNS TRIGGER AS $$
DECLARE
  job_url TEXT;
  job_slug TEXT;
  is_paid BOOLEAN := false;
BEGIN
  -- URL_UPDATED path: active+public job
  IF NEW.status = 'active' AND NEW.visibility = 'public' THEN
    job_slug := regexp_replace(lower(NEW.title), '[^a-z0-9]+', '-', 'g');
    job_slug := trim(both '-' from job_slug);

    IF NEW.public_slug IS NOT NULL AND NEW.public_slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.public_slug;
    ELSIF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.slug;
    ELSE
      job_url := 'https://worklyindia.devs.surf/job/' || job_slug || '-' || NEW.id;
    END IF;

    -- Ensure a job_indexing_status row exists so UI shows paywall
    INSERT INTO public.job_indexing_status (job_id, url, google_status, bing_status, is_paid_for_indexing)
    VALUES (NEW.id, job_url, 'queued', 'queued', false)
    ON CONFLICT (job_id) DO NOTHING;

    -- Check paid flag
    SELECT COALESCE(is_paid_for_indexing, false) INTO is_paid
      FROM public.job_indexing_status WHERE job_id = NEW.id;

    IF NOT is_paid THEN
      RETURN NEW;  -- Skip Google queue; user must pay first
    END IF;

    INSERT INTO public.google_indexing_queue (
      job_id, url, status, action, priority, source, page_type, retry_count, created_at
    ) VALUES (
      NEW.id, job_url, 'pending', 'URL_UPDATED',
      CASE WHEN TG_OP = 'INSERT' THEN 8 ELSE 5 END,
      CASE WHEN TG_OP = 'INSERT' THEN 'job_create_trigger' ELSE 'job_update_trigger' END,
      'job', 0, NOW()
    )
    ON CONFLICT (url) DO UPDATE SET
      status = 'pending', action = 'URL_UPDATED',
      priority = GREATEST(google_indexing_queue.priority, EXCLUDED.priority),
      retry_count = 0, created_at = NOW();

  -- URL_DELETED path: job became inactive/non-public (unchanged behaviour)
  ELSIF (OLD.status = 'active' AND NEW.status != 'active') OR
        (OLD.visibility = 'public' AND NEW.visibility != 'public') THEN
    IF NEW.public_slug IS NOT NULL AND NEW.public_slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.public_slug;
    ELSIF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.slug;
    ELSE
      job_slug := regexp_replace(lower(NEW.title), '[^a-z0-9]+', '-', 'g');
      job_slug := trim(both '-' from job_slug);
      job_url := 'https://worklyindia.devs.surf/job/' || job_slug || '-' || NEW.id;
    END IF;

    INSERT INTO public.google_indexing_queue (
      job_id, url, status, action, priority, source, page_type, retry_count, created_at
    ) VALUES (
      NEW.id, job_url, 'pending', 'URL_DELETED', 10, 'job_deactivate_trigger', 'job', 0, NOW()
    )
    ON CONFLICT (url) DO UPDATE SET
      status = 'pending', action = 'URL_DELETED', priority = 10, retry_count = 0, created_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.add_job_to_indexing_queue() IS 'Queues URL_UPDATED into Google indexing only when job_indexing_status.is_paid_for_indexing is true (paywall). URL_DELETED path unaffected.';
