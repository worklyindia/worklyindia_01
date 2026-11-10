-- ============================================================================
-- FIX: Add missing columns to point_adjustments table
-- ============================================================================

ALTER TABLE public.point_adjustments 
ADD COLUMN IF NOT EXISTS admin_note text,
ADD COLUMN IF NOT EXISTS previous_balance integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_balance integer DEFAULT 0;

-- ============================================================================
-- FIX: Update saved_jobs to match expected schema (add employer_id if needed)
-- ============================================================================

-- Some queries may expect employer_id, but jobs have employer_id. 
-- Let's check and add a computed relation approach

-- ============================================================================
-- FIX: Recreate adjust_wallet_points to match actual schema
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

  -- Get or create wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance)
    VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + p_points;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Adjustment: %', v_current_balance, p_points;
  END IF;

  -- Insert the adjustment record with all columns
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