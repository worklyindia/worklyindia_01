-- Improve wallet operations with better error handling and atomic operations
CREATE OR REPLACE FUNCTION public.increment_wallet_points_secure(p_user_id uuid, p_points integer, p_amount integer)
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
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  -- Use advisory lock to prevent concurrent modifications
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || '_wallet'));
  
  -- Upsert wallet record with atomic operation
  INSERT INTO public.wallets (user_id, balance_points, total_purchased, updated_at)
  VALUES (p_user_id, p_points, p_amount, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance_points = wallets.balance_points + p_points,
    total_purchased = wallets.total_purchased + p_amount,
    updated_at = now()
  RETURNING * INTO wallet_record;
  
  -- Return success result with wallet details
  transaction_result := jsonb_build_object(
    'success', true,
    'user_id', wallet_record.user_id,
    'new_balance', wallet_record.balance_points,
    'points_added', p_points,
    'amount_paid', p_amount,
    'total_purchased', wallet_record.total_purchased,
    'updated_at', wallet_record.updated_at
  );
  
  RETURN transaction_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE EXCEPTION 'Wallet update failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

-- Create function to deduct points safely
CREATE OR REPLACE FUNCTION public.deduct_wallet_points_secure(p_user_id uuid, p_points integer, p_reason text DEFAULT 'Points deduction')
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
  
  -- Get current wallet balance
  SELECT * INTO wallet_record FROM public.wallets WHERE user_id = p_user_id;
  
  IF wallet_record IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;
  
  IF wallet_record.balance_points < p_points THEN
    RAISE EXCEPTION 'Insufficient points. Available: %, Required: %', wallet_record.balance_points, p_points;
  END IF;
  
  -- Update wallet with deduction
  UPDATE public.wallets 
  SET 
    balance_points = balance_points - p_points,
    total_spent = total_spent + p_points,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO wallet_record;
  
  -- Return success result
  transaction_result := jsonb_build_object(
    'success', true,
    'user_id', wallet_record.user_id,
    'new_balance', wallet_record.balance_points,
    'points_deducted', p_points,
    'total_spent', wallet_record.total_spent,
    'reason', p_reason,
    'updated_at', wallet_record.updated_at
  );
  
  RETURN transaction_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Points deduction failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;