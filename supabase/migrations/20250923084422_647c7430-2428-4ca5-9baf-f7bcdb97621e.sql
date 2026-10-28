-- Add helper function to safely add wallet points with proper error handling
CREATE OR REPLACE FUNCTION add_wallet_points_secure(p_user_id uuid, p_points integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    RAISE EXCEPTION 'Wallet points addition failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;