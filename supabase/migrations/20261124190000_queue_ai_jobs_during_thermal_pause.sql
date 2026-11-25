-- Queue local AI requests for an online paired phone even while Android has paused inference
-- for thermal or memory safety. VoiceRelayService re-checks device headroom before every
-- claim and will not run Qwen until the phone is safe.
CREATE OR REPLACE FUNCTION public.select_workly_voice_worker(
  p_user_id uuid,
  p_job_type text,
  p_requested_model text DEFAULT NULL::text,
  p_requested_language text DEFAULT NULL::text,
  p_min_ram_bytes bigint DEFAULT 0,
  p_exclude_device uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  device_id uuid,
  selected_model text,
  selected_pack_id text,
  selected_model_name text,
  queue_depth bigint,
  worker_online boolean,
  model_ready boolean,
  language_ready boolean
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_model_ready boolean := false;
  v_language_ready boolean := false;
  v_device_id uuid;
  v_model text;
  v_pack_id text;
  v_model_name text;
  v_queue_depth bigint;
  v_online boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.workly_ai_voice_devices d
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.model_capabilities) = 'array'
        THEN d.model_capabilities ELSE '[]'::jsonb END
    ) cap
    WHERE d.user_id = p_user_id
      AND d.worker_enabled = true
      AND d.revoked_at IS NULL
      AND cap->>'task' = p_job_type
      AND cap->>'ready' = 'true'
      AND (nullif(p_requested_model, '') IS NULL OR cap->>'model' = p_requested_model)
  ) INTO v_model_ready;

  SELECT (
    nullif(p_requested_language, '') IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workly_ai_voice_devices d
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.model_capabilities) = 'array'
          THEN d.model_capabilities ELSE '[]'::jsonb END
      ) cap
      WHERE d.user_id = p_user_id
        AND d.worker_enabled = true
        AND d.revoked_at IS NULL
        AND cap->>'task' = p_job_type
        AND cap->>'ready' = 'true'
        AND (nullif(p_requested_model, '') IS NULL OR cap->>'model' = p_requested_model)
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(cap->'languages') = 'array'
              THEN cap->'languages' ELSE '[]'::jsonb END
          ) lang(value)
          WHERE lower(lang.value) = lower(p_requested_language)
            OR lower(lang.value) = 'multilingual'
            OR (
              p_job_type <> 'translate'
              AND split_part(lower(lang.value), '-', 1) =
                  split_part(lower(p_requested_language), '-', 1)
            )
        )
    )
  ) INTO v_language_ready;

  -- Route only to a recently seen device with the requested, downloaded model.
  -- Do not reject a worker just because its current thermal/RAM metrics pause inference:
  -- the Android service owns the final safety gate and will claim this queued job later.
  SELECT
    d.id,
    cap->>'model',
    coalesce(nullif(cap->>'pack_id', ''), cap->>'model'),
    coalesce(nullif(cap->>'model_name', ''), nullif(cap->>'pack_id', ''), cap->>'model'),
    q.active_count,
    true
  INTO
    v_device_id,
    v_model,
    v_pack_id,
    v_model_name,
    v_queue_depth,
    v_online
  FROM public.workly_ai_voice_devices d
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.model_capabilities) = 'array'
      THEN d.model_capabilities ELSE '[]'::jsonb END
  ) cap
  CROSS JOIN LATERAL (
    SELECT count(*)::bigint AS active_count
    FROM public.workly_ai_voice_jobs active
    WHERE active.device_id = d.id
      AND active.status IN ('pending', 'running')
      AND active.expires_at > now()
  ) q
  WHERE d.user_id = p_user_id
    AND (p_exclude_device IS NULL OR d.id <> p_exclude_device)
    AND d.worker_enabled = true
    AND d.revoked_at IS NULL
    AND d.last_seen_at > now() - interval '60 seconds'
    AND cap->>'task' = p_job_type
    AND cap->>'ready' = 'true'
    AND (nullif(p_requested_model, '') IS NULL OR cap->>'model' = p_requested_model)
    AND (
      nullif(p_requested_language, '') IS NULL
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(cap->'languages') = 'array'
            THEN cap->'languages' ELSE '[]'::jsonb END
        ) lang(value)
        WHERE lower(lang.value) = lower(p_requested_language)
          OR lower(lang.value) = 'multilingual'
          OR (
            p_job_type <> 'translate'
            AND split_part(lower(lang.value), '-', 1) =
                split_part(lower(p_requested_language), '-', 1)
          )
      )
    )
    AND q.active_count < CASE WHEN p_job_type = 'ai' THEN 5 ELSE 100 END
  ORDER BY q.active_count ASC, d.last_seen_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    v_device_id,
    v_model,
    v_pack_id,
    v_model_name,
    coalesce(v_queue_depth, 0),
    coalesce(v_online, false),
    v_model_ready,
    v_language_ready;
END;
$function$;
