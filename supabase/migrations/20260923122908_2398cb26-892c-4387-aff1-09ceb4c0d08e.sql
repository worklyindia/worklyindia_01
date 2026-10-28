CREATE OR REPLACE FUNCTION public.adjust_wallet_points(
  p_user_id uuid,
  p_points integer,
  p_adjustment_type text,
  p_reason text DEFAULT NULL::text,
  p_admin_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_adjustment_id uuid;
  v_normalized_type text;
  v_points_amount integer;
  v_delta integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can adjust wallet points';
  END IF;

  v_normalized_type := lower(trim(p_adjustment_type));
  IF v_normalized_type NOT IN ('add', 'deduct') THEN
    RAISE EXCEPTION 'Invalid adjustment type. Use add or deduct';
  END IF;

  v_points_amount := abs(p_points);
  IF v_points_amount = 0 THEN
    RAISE EXCEPTION 'Points must be greater than zero';
  END IF;

  v_delta := CASE WHEN v_normalized_type = 'deduct' THEN -v_points_amount ELSE v_points_amount END;

  SELECT id, balance_points
  INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance_points, total_purchased, total_spent)
    VALUES (p_user_id, 0, 0, 0)
    RETURNING id, balance_points INTO v_wallet_id, v_current_balance;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + v_delta;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Deduction: %', v_current_balance, v_points_amount;
  END IF;

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
    v_points_amount,
    v_normalized_type,
    p_reason,
    p_admin_note,
    auth.uid(),
    v_current_balance,
    v_new_balance
  )
  RETURNING id INTO v_adjustment_id;

  UPDATE wallets
  SET balance_points = v_new_balance,
      total_spent = CASE
        WHEN v_normalized_type = 'deduct' THEN COALESCE(total_spent, 0) + v_points_amount
        ELSE total_spent
      END,
      updated_at = now()
  WHERE id = v_wallet_id;

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'points_adjusted', v_delta
  );
END;
$function$;