-- Create missing database functions

-- Function to add wallet points securely
CREATE OR REPLACE FUNCTION public.add_wallet_points_secure(p_user_id uuid, p_points integer, p_reason text DEFAULT 'Points added'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wallet_record RECORD;
  transaction_result jsonb;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF p_points <= 0 THEN
    RAISE EXCEPTION 'Points must be positive';
  END IF;
  
  -- Use advisory lock to prevent concurrent modifications
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || '_wallet'));
  
  -- Upsert wallet record with atomic operation
  INSERT INTO public.wallets (user_id, balance_points, updated_at)
  VALUES (p_user_id, p_points, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance_points = wallets.balance_points + p_points,
    updated_at = now()
  RETURNING * INTO wallet_record;
  
  -- Return success result with wallet details
  transaction_result := jsonb_build_object(
    'success', true,
    'user_id', wallet_record.user_id,
    'new_balance', wallet_record.balance_points,
    'points_added', p_points,
    'reason', p_reason,
    'updated_at', wallet_record.updated_at
  );
  
  RETURN transaction_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE EXCEPTION 'Wallet update failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

-- Function to check job boost status
CREATE OR REPLACE FUNCTION public.check_job_boost_status(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_job_record RECORD;
  v_active_boost_count INTEGER := 0;
  v_boost_end_date TIMESTAMP WITH TIME ZONE := NULL;
  v_has_expired_boost BOOLEAN := FALSE;
  v_has_orphaned_boost BOOLEAN := FALSE;
BEGIN
  -- Get job details
  SELECT * INTO v_job_record FROM public.jobs WHERE id = p_job_id;
  
  IF v_job_record IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  -- Check for active boosts in job_boosts table
  SELECT COUNT(*), MAX(boost_end_date) 
  INTO v_active_boost_count, v_boost_end_date
  FROM public.job_boosts 
  WHERE job_id = p_job_id 
    AND status = 'active' 
    AND boost_end_date > now();
  
  -- Check for expired boosts that haven't been cleaned up
  SELECT EXISTS(
    SELECT 1 FROM public.job_boosts 
    WHERE job_id = p_job_id 
      AND status = 'active' 
      AND boost_end_date <= now()
  ) INTO v_has_expired_boost;
  
  -- Check for orphaned boosts (job shows boosted but no active boost record)
  IF v_job_record.is_boosted = true AND v_active_boost_count = 0 THEN
    v_has_orphaned_boost := TRUE;
  END IF;
  
  -- Use job table boost_end_date as fallback
  IF v_boost_end_date IS NULL THEN
    v_boost_end_date := v_job_record.boost_end_date;
  END IF;
  
  v_result := jsonb_build_object(
    'job_id', p_job_id,
    'can_boost', (v_active_boost_count = 0 AND NOT (v_job_record.is_boosted = true AND v_job_record.boost_end_date > now())),
    'is_boosted', COALESCE(v_job_record.is_boosted, false),
    'boost_end_date', v_boost_end_date,
    'has_expired_boost', v_has_expired_boost,
    'active_boost_count', v_active_boost_count,
    'has_orphaned_boost', v_has_orphaned_boost
  );
  
  RETURN v_result;
END;
$function$;

-- Function to activate job boost
CREATE OR REPLACE FUNCTION public.activate_job_boost(p_job_boost_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_boost_record RECORD;
  v_boost_end_date TIMESTAMP WITH TIME ZONE;
  v_package_record RECORD;
BEGIN
  -- Get boost record
  SELECT * INTO v_boost_record FROM public.job_boosts WHERE id = p_job_boost_id;
  
  IF v_boost_record IS NULL THEN
    RAISE EXCEPTION 'Job boost record not found';
  END IF;
  
  -- Get package details
  SELECT * INTO v_package_record FROM public.boost_packages WHERE id = v_boost_record.boost_package_id;
  
  IF v_package_record IS NULL THEN
    RAISE EXCEPTION 'Boost package not found';
  END IF;
  
  -- Calculate boost end date
  v_boost_end_date := now() + (v_package_record.boost_days || ' days')::INTERVAL;
  
  -- Update boost record
  UPDATE public.job_boosts SET
    status = 'active',
    boost_start_date = now(),
    boost_end_date = v_boost_end_date,
    updated_at = now()
  WHERE id = p_job_boost_id;
  
  -- Update job record
  UPDATE public.jobs SET
    is_boosted = true,
    boost_level = v_package_record.boost_level,
    boost_end_date = v_boost_end_date,
    updated_at = now()
  WHERE id = v_boost_record.job_id;
  
  RAISE NOTICE 'Job boost activated successfully for job %', v_boost_record.job_id;
END;
$function$;