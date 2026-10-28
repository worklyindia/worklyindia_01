ALTER TABLE public.storage_usage_stats ADD COLUMN IF NOT EXISTS latest_at timestamptz;

CREATE OR REPLACE FUNCTION public.storage_stats_apply(p_provider text, p_bucket text, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.storage_usage_stats AS s (provider, bucket, prefix, parent, file_count, total_size, latest_at, updated_at)
  SELECT p_provider, p_bucket, d.prefix, d.parent, sum(d.cnt), sum(d.sz), max(d.at), now()
  FROM (
    SELECT '' AS prefix, NULL::text AS parent, (i->>'count')::bigint AS cnt, (i->>'size')::bigint AS sz, NULLIF(i->>'at', '')::timestamptz AS at
    FROM jsonb_array_elements(p_items) i
    UNION ALL
    SELECT array_to_string(parts[1:n], '/'),
           array_to_string(parts[1:n-1], '/'),
           cnt, sz, at
    FROM (
      SELECT string_to_array(i->>'path', '/') AS parts, (i->>'count')::bigint AS cnt, (i->>'size')::bigint AS sz, NULLIF(i->>'at', '')::timestamptz AS at
      FROM jsonb_array_elements(p_items) i
    ) f, generate_series(1, greatest(array_length(f.parts, 1) - 1, 0)) n
  ) d
  GROUP BY d.prefix, d.parent
  ON CONFLICT (provider, bucket, prefix) DO UPDATE
    SET file_count = greatest(0, s.file_count + excluded.file_count),
        total_size = greatest(0, s.total_size + excluded.total_size),
        latest_at = CASE
          WHEN excluded.latest_at IS NULL THEN s.latest_at
          WHEN s.latest_at IS NULL THEN excluded.latest_at
          ELSE greatest(s.latest_at, excluded.latest_at) END,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.storage_stats_apply(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_stats_apply(text, text, jsonb) TO service_role;

DROP FUNCTION IF EXISTS public.admin_storage_folder_stats(text, text);
CREATE FUNCTION public.admin_storage_folder_stats(p_bucket text, p_prefix text DEFAULT ''::text)
RETURNS TABLE(folder text, file_count bigint, total_size bigint, latest_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
  WITH base AS (
    SELECT
      CASE WHEN p_prefix = '' THEN o.name
           ELSE substring(o.name from length(rtrim(p_prefix, '/')) + 2)
      END AS rel,
      COALESCE((o.metadata->>'size')::bigint, 0) AS sz,
      (o.name = '.keep' OR o.name LIKE '%/.keep') AS is_keep,
      COALESCE(o.updated_at, o.created_at) AS at
    FROM storage.objects o
    WHERE o.bucket_id = p_bucket
      AND (p_prefix = '' OR o.name LIKE rtrim(p_prefix, '/') || '/%')
  )
  SELECT split_part(rel, '/', 1)::text,
         count(*) FILTER (WHERE NOT is_keep)::bigint,
         COALESCE(sum(sz) FILTER (WHERE NOT is_keep), 0)::bigint,
         max(at)
  FROM base
  WHERE position('/' in rel) > 0
  GROUP BY 1
$function$;
REVOKE ALL ON FUNCTION public.admin_storage_folder_stats(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_storage_folder_stats(text, text) TO service_role;