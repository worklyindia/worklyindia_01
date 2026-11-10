-- Create add_wallet_points_secure function for refunds
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
  
  -- Update wallet with addition
  UPDATE public.wallets 
  SET 
    balance_points = balance_points + p_points,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO wallet_record;
  
  IF wallet_record IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;
  
  -- Return success result
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
    RAISE EXCEPTION 'Points addition failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

-- Create activate_job_boost function
CREATE OR REPLACE FUNCTION public.activate_job_boost(p_job_boost_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  boost_record RECORD;
  package_record RECORD;
BEGIN
  -- Get boost record with package details
  SELECT jb.*, bp.boost_days, bp.boost_level 
  INTO boost_record
  FROM job_boosts jb
  JOIN boost_packages bp ON bp.id = jb.boost_package_id
  WHERE jb.id = p_job_boost_id;
  
  IF boost_record IS NULL THEN
    RAISE EXCEPTION 'Job boost not found';
  END IF;
  
  -- Update job boost record with activation details
  UPDATE job_boosts SET
    status = 'active',
    boost_start_date = NOW(),
    boost_end_date = NOW() + (boost_record.boost_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_job_boost_id;
  
  -- Update job with boost status
  UPDATE jobs SET
    is_boosted = true,
    boost_level = boost_record.boost_level,
    updated_at = NOW()
  WHERE id = boost_record.job_id;
  
END;
$function$;