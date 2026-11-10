-- Create atomic wallet points deduction function with transaction safety
CREATE OR REPLACE FUNCTION deduct_wallet_points_atomic(
  p_user_id UUID,
  p_points INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Lock the wallet row for update to prevent race conditions
  SELECT balance_points INTO v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if wallet exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet not found',
      'error_code', 'WALLET_NOT_FOUND'
    );
  END IF;
  
  -- Check sufficient balance
  IF v_current_balance < p_points THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'error_code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_current_balance,
      'required', p_points
    );
  END IF;
  
  -- Deduct points atomically
  UPDATE wallets
  SET balance_points = balance_points - p_points,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance_points INTO v_new_balance;
  
  -- Log transaction in points_transactions table
  INSERT INTO points_transactions (
    user_id, 
    transaction_type, 
    points_amount,
    description,
    metadata
  ) VALUES (
    p_user_id, 
    'spend', 
    -p_points,
    p_reason,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'points_deducted', p_points,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON FUNCTION deduct_wallet_points_atomic IS 'Atomically deducts points from wallet with balance validation and transaction logging. Uses row-level locking to prevent race conditions.';