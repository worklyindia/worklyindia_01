CREATE TABLE public.whatsapp_send_windows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL,
  scope_id text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  sent_count integer NOT NULL DEFAULT 0,
  burst_second timestamptz,
  burst_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_send_windows_scope_key UNIQUE (scope, scope_id),
  CONSTRAINT whatsapp_send_windows_scope_check CHECK (scope IN ('api_key', 'sub_account', 'phone_number'))
);
GRANT ALL ON public.whatsapp_send_windows TO service_role;
ALTER TABLE public.whatsapp_send_windows ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.developer_sub_account_numbers ADD COLUMN IF NOT EXISTS messaging_tier text;
ALTER TABLE public.employer_whatsapp_accounts ADD COLUMN IF NOT EXISTS messaging_tier text;

CREATE OR REPLACE FUNCTION public.consume_whatsapp_send(
  _scope text,
  _scope_id text,
  _tier_limit integer DEFAULT 250,
  _burst_limit integer DEFAULT 20,
  _quality text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.whatsapp_send_windows%ROWTYPE;
  _effective_limit integer;
  _now timestamptz := now();
  _second timestamptz := date_trunc('second', _now);
  _resets_at timestamptz;
BEGIN
  IF _scope NOT IN ('api_key', 'sub_account', 'phone_number') THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'invalid_scope');
  END IF;

  INSERT INTO public.whatsapp_send_windows (scope, scope_id, window_start, sent_count)
  VALUES (_scope, _scope_id, _now, 0)
  ON CONFLICT (scope, scope_id) DO NOTHING;

  SELECT * INTO _row FROM public.whatsapp_send_windows
  WHERE scope = _scope AND scope_id = _scope_id
  FOR UPDATE;

  -- Roll the 24h window forward once it has fully elapsed (Meta-style rolling day).
  IF _row.window_start < _now - interval '24 hours' THEN
    _row.window_start := _now;
    _row.sent_count := 0;
  END IF;

  -- Meta-style quality throttle: YELLOW halves the tier, RED quarters it (min 50).
  _effective_limit := GREATEST(_tier_limit, 1);
  IF upper(COALESCE(_quality, '')) = 'YELLOW' THEN
    _effective_limit := GREATEST(_effective_limit / 2, 50);
  ELSIF upper(COALESCE(_quality, '')) = 'RED' THEN
    _effective_limit := GREATEST(_effective_limit / 4, 50);
  END IF;

  _resets_at := _row.window_start + interval '24 hours';

  -- Per-second burst cap (protects Meta throughput limits).
  IF _row.burst_second = _second AND _row.burst_count >= _burst_limit THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'burst_limit',
      'used', _row.sent_count, 'limit', _effective_limit,
      'remaining', GREATEST(_effective_limit - _row.sent_count, 0),
      'resets_at', _resets_at, 'retry_after_seconds', 1
    );
  END IF;

  IF _row.sent_count >= _effective_limit THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'tier_limit',
      'used', _row.sent_count, 'limit', _effective_limit,
      'remaining', 0, 'resets_at', _resets_at, 'retry_after_seconds', GREATEST(EXTRACT(EPOCH FROM (_resets_at - _now))::int, 1)
    );
  END IF;

  UPDATE public.whatsapp_send_windows SET
    window_start = _row.window_start,
    sent_count = _row.sent_count + 1,
    burst_second = _second,
    burst_count = CASE WHEN _row.burst_second = _second THEN _row.burst_count + 1 ELSE 1 END,
    updated_at = _now
  WHERE scope = _scope AND scope_id = _scope_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', _row.sent_count + 1, 'limit', _effective_limit,
    'remaining', GREATEST(_effective_limit - _row.sent_count - 1, 0),
    'resets_at', _resets_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_whatsapp_send(text, text, integer, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_whatsapp_send_usage(_scope text, _scope_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN w.id IS NULL OR w.window_start < now() - interval '24 hours'
    THEN jsonb_build_object('used', 0, 'window_start', now())
    ELSE jsonb_build_object('used', w.sent_count, 'window_start', w.window_start, 'resets_at', w.window_start + interval '24 hours')
  END
  FROM (SELECT 1) AS one
  LEFT JOIN public.whatsapp_send_windows w ON w.scope = _scope AND w.scope_id = _scope_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_send_usage(text, text) TO service_role;