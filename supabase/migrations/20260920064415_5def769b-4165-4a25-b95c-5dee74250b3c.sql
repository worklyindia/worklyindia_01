CREATE OR REPLACE FUNCTION public.admin_storage_bucket_stats()
RETURNS TABLE (bucket_id text, file_count bigint, total_size bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.bucket_id::text,
         count(*)::bigint,
         COALESCE(sum((o.metadata->>'size')::bigint), 0)::bigint
  FROM storage.objects o
  GROUP BY o.bucket_id
$$;

REVOKE ALL ON FUNCTION public.admin_storage_bucket_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_storage_bucket_stats() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_storage_folder_stats(p_bucket text, p_prefix text DEFAULT '')
RETURNS TABLE (folder text, file_count bigint, total_size bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH base AS (
    SELECT
      CASE WHEN p_prefix = '' THEN o.name
           ELSE substring(o.name from length(rtrim(p_prefix, '/')) + 2)
      END AS rel,
      COALESCE((o.metadata->>'size')::bigint, 0) AS sz
    FROM storage.objects o
    WHERE o.bucket_id = p_bucket
      AND (p_prefix = '' OR o.name LIKE rtrim(p_prefix, '/') || '/%')
  )
  SELECT split_part(rel, '/', 1)::text,
         count(*)::bigint,
         COALESCE(sum(sz), 0)::bigint
  FROM base
  WHERE position('/' in rel) > 0
  GROUP BY 1
$$;

REVOKE ALL ON FUNCTION public.admin_storage_folder_stats(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_storage_folder_stats(text, text) TO service_role;