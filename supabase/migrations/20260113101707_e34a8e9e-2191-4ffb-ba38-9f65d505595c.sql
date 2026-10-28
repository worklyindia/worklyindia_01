-- Create the get_user_ai_chat_status function
-- This function returns the user's AI chat plan, subscription status, and usage

CREATE OR REPLACE FUNCTION public.get_user_ai_chat_status(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_subscription RECORD;
  v_usage RECORD;
  v_result JSON;
  v_free_plan_id UUID;
  v_current_month_start DATE;
  v_current_month_end DATE;
BEGIN
  -- Get current month boundaries
  v_current_month_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_current_month_end := (date_trunc('month', CURRENT_DATE) + interval '1 month')::DATE;

  -- Get active subscription for user
  SELECT s.*, p.*
  INTO v_subscription
  FROM ai_chat_subscriptions s
  JOIN ai_chat_plans p ON s.plan_id = p.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.starts_at <= NOW()
    AND s.ends_at > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no active subscription, get the free plan
  IF v_subscription IS NULL THEN
    SELECT * INTO v_plan
    FROM ai_chat_plans
    WHERE price_inr = 0 AND is_active = true
    ORDER BY display_order
    LIMIT 1;
    
    -- If no free plan exists, create a default response
    IF v_plan IS NULL THEN
      RETURN json_build_object(
        'plan', json_build_object(
          'id', NULL,
          'name', 'No Plan',
          'price_inr', 0,
          'messages_per_month', 0,
          'voice_playback_per_month', 0,
          'voice_input_per_month', 0,
          'image_analysis_per_month', 0,
          'ai_model_tier', 'none',
          'priority_support', false,
          'features', '[]'::json
        ),
        'subscription', NULL,
        'usage', json_build_object(
          'messages_count', 0,
          'voice_playback_count', 0,
          'voice_input_count', 0,
          'image_analysis_count', 0,
          'tokens_used', 0
        )
      );
    END IF;
  ELSE
    -- Use the plan from subscription
    SELECT * INTO v_plan
    FROM ai_chat_plans
    WHERE id = v_subscription.plan_id;
  END IF;

  -- Get usage for current billing period
  -- For paid subscriptions, use subscription dates; for free, use calendar month
  IF v_subscription IS NOT NULL THEN
    SELECT 
      COALESCE(SUM(messages_count), 0) as messages_count,
      COALESCE(SUM(voice_playback_count), 0) as voice_playback_count,
      COALESCE(SUM(voice_input_count), 0) as voice_input_count,
      COALESCE(SUM(image_analysis_count), 0) as image_analysis_count,
      COALESCE(SUM(tokens_used), 0) as tokens_used
    INTO v_usage
    FROM ai_chat_usage
    WHERE user_id = p_user_id
      AND date >= v_subscription.starts_at::DATE
      AND date < v_subscription.ends_at::DATE;
  ELSE
    -- Free plan: use current calendar month
    SELECT 
      COALESCE(SUM(messages_count), 0) as messages_count,
      COALESCE(SUM(voice_playback_count), 0) as voice_playback_count,
      COALESCE(SUM(voice_input_count), 0) as voice_input_count,
      COALESCE(SUM(image_analysis_count), 0) as image_analysis_count,
      COALESCE(SUM(tokens_used), 0) as tokens_used
    INTO v_usage
    FROM ai_chat_usage
    WHERE user_id = p_user_id
      AND date >= v_current_month_start
      AND date < v_current_month_end;
  END IF;

  -- Build the result JSON
  v_result := json_build_object(
    'plan', json_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'price_inr', v_plan.price_inr,
      'messages_per_month', v_plan.messages_per_month,
      'voice_playback_per_month', v_plan.voice_playback_per_month,
      'voice_input_per_month', v_plan.voice_input_per_month,
      'image_analysis_per_month', v_plan.image_analysis_per_month,
      'ai_model_tier', v_plan.ai_model_tier,
      'priority_support', COALESCE(v_plan.priority_support, false),
      'features', COALESCE(v_plan.features, '[]'::json)
    ),
    'subscription', CASE 
      WHEN v_subscription IS NOT NULL THEN json_build_object(
        'status', v_subscription.status,
        'starts_at', v_subscription.starts_at,
        'ends_at', v_subscription.ends_at
      )
      ELSE NULL
    END,
    'usage', json_build_object(
      'messages_count', COALESCE(v_usage.messages_count, 0),
      'voice_playback_count', COALESCE(v_usage.voice_playback_count, 0),
      'voice_input_count', COALESCE(v_usage.voice_input_count, 0),
      'image_analysis_count', COALESCE(v_usage.image_analysis_count, 0),
      'tokens_used', COALESCE(v_usage.tokens_used, 0)
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_ai_chat_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ai_chat_status(UUID) TO anon;