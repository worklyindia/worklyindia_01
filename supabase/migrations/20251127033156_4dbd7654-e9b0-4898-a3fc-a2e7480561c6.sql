-- AI Career Chat Subscription System Tables

-- 1. AI Chat Plans Table
CREATE TABLE IF NOT EXISTS public.ai_chat_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_inr INTEGER NOT NULL DEFAULT 0,
  messages_per_month INTEGER NOT NULL,
  voice_playback_per_month INTEGER NOT NULL,
  voice_input_per_month INTEGER NOT NULL,
  image_analysis_per_month INTEGER NOT NULL,
  ai_model_tier TEXT NOT NULL DEFAULT 'basic',
  priority_support BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI Chat Subscriptions Table
CREATE TABLE IF NOT EXISTS public.ai_chat_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.ai_chat_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  razorpay_subscription_id TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, status)
);

-- 3. AI Chat Usage Table
CREATE TABLE IF NOT EXISTS public.ai_chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_count INTEGER DEFAULT 0,
  voice_playback_count INTEGER DEFAULT 0,
  voice_input_count INTEGER DEFAULT 0,
  image_analysis_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.ai_chat_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_plans (public read)
CREATE POLICY "Anyone can view active plans"
  ON public.ai_chat_plans FOR SELECT
  USING (is_active = true);

-- RLS Policies for ai_chat_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.ai_chat_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.ai_chat_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON public.ai_chat_subscriptions FOR ALL
  USING (true);

-- RLS Policies for ai_chat_usage
CREATE POLICY "Users can view their own usage"
  ON public.ai_chat_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all usage"
  ON public.ai_chat_usage FOR ALL
  USING (true);

-- Insert default plans
INSERT INTO public.ai_chat_plans (name, price_inr, messages_per_month, voice_playback_per_month, voice_input_per_month, image_analysis_per_month, ai_model_tier, priority_support, display_order, features)
VALUES 
  ('Free', 0, 50, 5, 5, 2, 'basic', false, 1, '["Basic AI Model", "50 Messages/month", "5 Voice Messages", "Community Support"]'::jsonb),
  ('Basic', 99, 200, 50, 50, 20, 'standard', false, 2, '["Standard AI Models", "200 Messages/month", "50 Voice Messages", "20 Image Analysis", "Fast Response"]'::jsonb),
  ('Pro', 299, 1000, 200, 200, 100, 'premium', true, 3, '["Premium AI Models", "1000 Messages/month", "200 Voice Messages", "100 Image Analysis", "Priority Response", "Email Support"]'::jsonb),
  ('Enterprise', 999, 999999, 999999, 999999, 999999, 'all', true, 4, '["All AI Models", "Unlimited Messages", "Unlimited Voice", "Unlimited Image Analysis", "Highest Priority", "Priority Support", "Custom Features"]'::jsonb);

-- Function to get user's current plan and usage
CREATE OR REPLACE FUNCTION public.get_user_ai_chat_status(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_plan RECORD;
  v_usage RECORD;
  v_result JSONB;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM public.ai_chat_subscriptions
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND ends_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get plan (default to Free if no subscription)
  IF v_subscription IS NULL THEN
    SELECT * INTO v_plan
    FROM public.ai_chat_plans
    WHERE name = 'Free' AND is_active = true
    LIMIT 1;
  ELSE
    SELECT * INTO v_plan
    FROM public.ai_chat_plans
    WHERE id = v_subscription.plan_id;
  END IF;

  -- Get today's usage
  SELECT * INTO v_usage
  FROM public.ai_chat_usage
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE;

  -- Build result
  v_result := jsonb_build_object(
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'price_inr', v_plan.price_inr,
      'messages_per_month', v_plan.messages_per_month,
      'voice_playback_per_month', v_plan.voice_playback_per_month,
      'voice_input_per_month', v_plan.voice_input_per_month,
      'image_analysis_per_month', v_plan.image_analysis_per_month,
      'ai_model_tier', v_plan.ai_model_tier,
      'features', v_plan.features
    ),
    'subscription', CASE 
      WHEN v_subscription IS NOT NULL THEN
        jsonb_build_object(
          'status', v_subscription.status,
          'starts_at', v_subscription.starts_at,
          'ends_at', v_subscription.ends_at
        )
      ELSE NULL
    END,
    'usage', jsonb_build_object(
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

-- Function to check and increment usage
CREATE OR REPLACE FUNCTION public.increment_ai_chat_usage(
  p_user_id UUID,
  p_usage_type TEXT, -- 'message', 'voice_playback', 'voice_input', 'image_analysis'
  p_tokens INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status JSONB;
  v_plan JSONB;
  v_usage JSONB;
  v_current_count INTEGER;
  v_limit INTEGER;
  v_allowed BOOLEAN := false;
BEGIN
  -- Get current status
  v_status := public.get_user_ai_chat_status(p_user_id);
  v_plan := v_status->'plan';
  v_usage := v_status->'usage';

  -- Check limits based on usage type
  CASE p_usage_type
    WHEN 'message' THEN
      v_current_count := (v_usage->>'messages_count')::INTEGER;
      v_limit := (v_plan->>'messages_per_month')::INTEGER;
    WHEN 'voice_playback' THEN
      v_current_count := (v_usage->>'voice_playback_count')::INTEGER;
      v_limit := (v_plan->>'voice_playback_per_month')::INTEGER;
    WHEN 'voice_input' THEN
      v_current_count := (v_usage->>'voice_input_count')::INTEGER;
      v_limit := (v_plan->>'voice_input_per_month')::INTEGER;
    WHEN 'image_analysis' THEN
      v_current_count := (v_usage->>'image_analysis_count')::INTEGER;
      v_limit := (v_plan->>'image_analysis_per_month')::INTEGER;
    ELSE
      RETURN jsonb_build_object('allowed', false, 'error', 'Invalid usage type');
  END CASE;

  -- Check if allowed
  v_allowed := v_current_count < v_limit;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Limit reached',
      'current', v_current_count,
      'limit', v_limit,
      'plan', v_plan->>'name'
    );
  END IF;

  -- Increment usage
  INSERT INTO public.ai_chat_usage (user_id, date, messages_count, voice_playback_count, voice_input_count, image_analysis_count, tokens_used)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_usage_type = 'message' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'voice_playback' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'voice_input' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'image_analysis' THEN 1 ELSE 0 END,
    p_tokens
  )
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    messages_count = public.ai_chat_usage.messages_count + CASE WHEN p_usage_type = 'message' THEN 1 ELSE 0 END,
    voice_playback_count = public.ai_chat_usage.voice_playback_count + CASE WHEN p_usage_type = 'voice_playback' THEN 1 ELSE 0 END,
    voice_input_count = public.ai_chat_usage.voice_input_count + CASE WHEN p_usage_type = 'voice_input' THEN 1 ELSE 0 END,
    image_analysis_count = public.ai_chat_usage.image_analysis_count + CASE WHEN p_usage_type = 'image_analysis' THEN 1 ELSE 0 END,
    tokens_used = public.ai_chat_usage.tokens_used + p_tokens,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_limit - v_current_count - 1,
    'limit', v_limit,
    'plan', v_plan->>'name'
  );
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_ai_chat_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_chat_plans_updated_at
  BEFORE UPDATE ON public.ai_chat_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_chat_tables_updated_at();

CREATE TRIGGER update_ai_chat_subscriptions_updated_at
  BEFORE UPDATE ON public.ai_chat_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_chat_tables_updated_at();

CREATE TRIGGER update_ai_chat_usage_updated_at
  BEFORE UPDATE ON public.ai_chat_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_chat_tables_updated_at();