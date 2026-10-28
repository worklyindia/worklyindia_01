-- ============================================================================
-- FIX: Wallet table uses balance_points not balance - update function
-- ============================================================================

DROP FUNCTION IF EXISTS public.adjust_wallet_points(uuid, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.adjust_wallet_points(
  p_user_id uuid,
  p_points integer,
  p_adjustment_type text,
  p_reason text DEFAULT NULL,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_adjustment_id uuid;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can adjust wallet points';
  END IF;

  -- Get or create wallet (use balance_points - the actual column name)
  SELECT id, balance_points INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance_points, total_purchased, total_spent)
    VALUES (p_user_id, 0, 0, 0)
    RETURNING id, balance_points INTO v_wallet_id, v_current_balance;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + p_points;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Adjustment: %', v_current_balance, p_points;
  END IF;

  -- Insert the adjustment record
  INSERT INTO point_adjustments (
    user_id,
    points,
    adjustment_type,
    reason,
    admin_note,
    admin_id,
    previous_balance,
    new_balance
  ) VALUES (
    p_user_id,
    p_points,
    p_adjustment_type,
    p_reason,
    p_admin_note,
    auth.uid(),
    v_current_balance,
    v_new_balance
  )
  RETURNING id INTO v_adjustment_id;

  -- Update wallet balance_points (not balance)
  UPDATE wallets 
  SET balance_points = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'points_adjusted', p_points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_wallet_points(uuid, integer, text, text, text) TO authenticated;

-- ============================================================================
-- FIX: Add balance alias/column to wallets if needed for backward compatibility
-- Or update any triggers that reference 'balance'
-- ============================================================================

-- Check and update any trigger that uses 'balance' column
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON public.point_adjustments;

-- The function that updates wallet should use balance_points
CREATE OR REPLACE FUNCTION public.update_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update wallet balance_points based on point adjustment
  UPDATE wallets
  SET balance_points = balance_points + NEW.points,
      updated_at = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Don't recreate the trigger since adjust_wallet_points now handles the update directly