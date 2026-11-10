UPDATE public.job_posting_settings
SET is_active = false
WHERE is_active = true
  AND id <> (SELECT id FROM public.job_posting_settings WHERE is_active = true ORDER BY updated_at DESC LIMIT 1);

UPDATE public.job_posting_settings
SET duration_packages = (
  SELECT jsonb_agg(p || jsonb_build_object('price', p->'points'))
  FROM jsonb_array_elements(duration_packages) p
)
WHERE is_active = true AND jsonb_typeof(duration_packages) = 'array';