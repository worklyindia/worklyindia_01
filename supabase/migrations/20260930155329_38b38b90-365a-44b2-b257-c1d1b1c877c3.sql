CREATE OR REPLACE FUNCTION public.is_ai_unlimited_owner(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND role='owner')
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=p_user_id AND role='owner');
$$;

ALTER FUNCTION public.check_ai_chat_usage_only(uuid,text) RENAME TO check_ai_chat_usage_only_base;
ALTER FUNCTION public.increment_ai_chat_usage(uuid,text,integer) RENAME TO increment_ai_chat_usage_base;
ALTER FUNCTION public.get_user_ai_chat_status(uuid) RENAME TO get_user_ai_chat_status_base;

CREATE FUNCTION public.check_ai_chat_usage_only(p_user_id uuid, p_usage_type text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF public.is_ai_unlimited_owner(p_user_id) THEN
    RETURN jsonb_build_object('allowed',true,'plan','Owner','limit',999999,'used',0,'remaining',999999);
  END IF;
  RETURN public.check_ai_chat_usage_only_base(p_user_id,p_usage_type);
END $$;

CREATE FUNCTION public.increment_ai_chat_usage(p_user_id uuid, p_usage_type text, p_tokens integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF public.is_ai_unlimited_owner(p_user_id) THEN
    RETURN jsonb_build_object('allowed',true,'plan','Owner','current',0,'limit',999999,'remaining',999999);
  END IF;
  RETURN public.increment_ai_chat_usage_base(p_user_id,p_usage_type,p_tokens);
END $$;

CREATE FUNCTION public.get_user_ai_chat_status(p_user_id uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
  r := public.get_user_ai_chat_status_base(p_user_id)::jsonb;
  IF public.is_ai_unlimited_owner(p_user_id) AND r ? 'plan' THEN
    r := jsonb_set(r,'{plan}', COALESCE(r->'plan','{}'::jsonb) || jsonb_build_object(
      'name','Owner (Unlimited)','messages_per_month',999999,'voice_playback_per_month',999999,
      'voice_input_per_month',999999,'image_analysis_per_month',999999,'ai_generations_per_month',999999,
      'priority_support',true));
  END IF;
  RETURN r::json;
END $$;

GRANT EXECUTE ON FUNCTION public.check_ai_chat_usage_only(uuid,text), public.increment_ai_chat_usage(uuid,text,integer), public.get_user_ai_chat_status(uuid), public.is_ai_unlimited_owner(uuid) TO anon, authenticated, service_role;