CREATE TABLE public.storage_usage_stats (
  provider text NOT NULL CHECK (provider IN ('supabase','r2')),
  bucket text NOT NULL,
  prefix text NOT NULL DEFAULT '',
  parent text,
  file_count bigint NOT NULL DEFAULT 0,
  total_size bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, bucket, prefix)
);
CREATE INDEX storage_usage_stats_parent_idx ON public.storage_usage_stats (provider, bucket, parent);
GRANT ALL ON public.storage_usage_stats TO service_role;
ALTER TABLE public.storage_usage_stats ENABLE ROW LEVEL SECURITY;

-- Applies file count/size deltas to a file's bucket total and every ancestor folder.
-- p_items: [{ "path": "a/b/c.png", "count": 1, "size": 1234 }, ...]
CREATE OR REPLACE FUNCTION public.storage_stats_apply(p_provider text, p_bucket text, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.storage_usage_stats AS s (provider, bucket, prefix, parent, file_count, total_size, updated_at)
  SELECT p_provider, p_bucket, d.prefix, d.parent, sum(d.cnt), sum(d.sz), now()
  FROM (
    SELECT '' AS prefix, NULL::text AS parent, (i->>'count')::bigint AS cnt, (i->>'size')::bigint AS sz
    FROM jsonb_array_elements(p_items) i
    UNION ALL
    SELECT array_to_string(parts[1:n], '/'),
           array_to_string(parts[1:n-1], '/'),
           cnt, sz
    FROM (
      SELECT string_to_array(i->>'path', '/') AS parts, (i->>'count')::bigint AS cnt, (i->>'size')::bigint AS sz
      FROM jsonb_array_elements(p_items) i
    ) f, generate_series(1, greatest(array_length(f.parts, 1) - 1, 0)) n
  ) d
  GROUP BY d.prefix, d.parent
  ON CONFLICT (provider, bucket, prefix) DO UPDATE
    SET file_count = greatest(0, s.file_count + excluded.file_count),
        total_size = greatest(0, s.total_size + excluded.total_size),
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.storage_stats_apply(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_stats_apply(text, text, jsonb) TO service_role;