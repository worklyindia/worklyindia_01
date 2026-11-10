
-- Step 1: Mark all expired subscriptions as 'expired'
UPDATE ai_chat_subscriptions 
SET status = 'expired', updated_at = NOW()
WHERE ends_at < NOW() 
AND status = 'active';

-- Step 2: Drop and recreate the function with conflict handling
CREATE OR REPLACE FUNCTION public.check_ai_chat_usage_only(p_user_id uuid, p_usage_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_id uuid;
  v_plan_limit integer;
  v_plan_name text;
  v_current_usage integer;
  v_subscription_id uuid;
  v_free_plan_id uuid;
  v_month_start date;
  v_month_end date;
  v_existing_sub_id uuid;
BEGIN
  -- Calculate current month boundaries
  v_month_start := date_trunc('month', CURRENT_DATE)::date;
  v_month_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;

  -- Get user's active subscription (that hasn't expired)
  SELECT s.id, s.plan_id, p.name
  INTO v_subscription_id, v_plan_id, v_plan_name
  FROM ai_chat_subscriptions s
  JOIN ai_chat_plans p ON s.plan_id = p.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND CURRENT_TIMESTAMP BETWEEN s.starts_at AND s.ends_at
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no active subscription, handle renewal or creation
  IF v_subscription_id IS NULL THEN
    -- Get Free plan ID
    SELECT id INTO v_free_plan_id
    FROM ai_chat_plans
    WHERE name = 'Free' AND is_active = true
    LIMIT 1;

    IF v_free_plan_id IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'error', 'No Free plan configured');
    END IF;

    -- Check for existing subscription (expired or any status) to renew
    SELECT id INTO v_existing_sub_id
    FROM ai_chat_subscriptions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_sub_id IS NOT NULL THEN
      -- Renew existing subscription instead of creating new one
      UPDATE ai_chat_subscriptions
      SET plan_id = v_free_plan_id,
          status = 'active',
          starts_at = v_month_start,
          ends_at = v_month_end + interval '1 day',
          updated_at = NOW()
      WHERE id = v_existing_sub_id
      RETURNING id INTO v_subscription_id;
    ELSE
      -- No subscription exists, create new one
      INSERT INTO ai_chat_subscriptions (user_id, plan_id, status, starts_at, ends_at)
      VALUES (p_user_id, v_free_plan_id, 'active', v_month_start, v_month_end + interval '1 day')
      RETURNING id INTO v_subscription_id;
    END IF;

    v_plan_id := v_free_plan_id;
    SELECT name INTO v_plan_name FROM ai_chat_plans WHERE id = v_free_plan_id;
  END IF;

  -- Get the limit for the requested usage type
  SELECT CASE p_usage_type
      WHEN 'message' THEN messages_per_month
      WHEN 'voice_playback' THEN voice_playback_per_month
      WHEN 'voice_input' THEN voice_input_per_month
      WHEN 'image_analysis' THEN image_analysis_per_month
      ELSE 0
    END
  INTO v_plan_limit
  FROM ai_chat_plans WHERE id = v_plan_id;

  -- Get current MONTHLY usage (aggregate all days in the month)
  SELECT COALESCE(SUM(
    CASE p_usage_type
      WHEN 'message' THEN messages_count
      WHEN 'voice_playback' THEN voice_playback_count
      WHEN 'voice_input' THEN voice_input_count
      WHEN 'image_analysis' THEN image_analysis_count
      ELSE 0
    END
  ), 0)
  INTO v_current_usage
  FROM ai_chat_usage
  WHERE user_id = p_user_id AND date >= v_month_start AND date <= v_month_end;

  -- Check if unlimited
  IF v_plan_limit >= 999999 THEN
    RETURN jsonb_build_object('allowed', true, 'plan', v_plan_name, 'limit', v_plan_limit, 'used', v_current_usage, 'remaining', 999999);
  END IF;

  -- Check if limit reached
  IF v_current_usage >= v_plan_limit THEN
    RETURN jsonb_build_object('allowed', false, 'error', p_usage_type || ' limit reached', 'plan', v_plan_name, 'limit', v_plan_limit, 'used', v_current_usage, 'remaining', 0);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'plan', v_plan_name, 'limit', v_plan_limit, 'used', v_current_usage, 'remaining', v_plan_limit - v_current_usage);
END;
$function$;
