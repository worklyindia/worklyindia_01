CREATE OR REPLACE FUNCTION public.admin_get_comprehensive_wallet_history(p_user_id uuid)
RETURNS TABLE(id text, type text, amount integer, points integer, description text, created_at timestamp with time zone, status text, reason text, adjustment_type text, razorpay_order_id text, razorpay_payment_id text, txn_id text, metadata jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  WITH all_transactions AS (
    SELECT
      t.id::text AS id,
      'purchase'::text AS type,
      t.amount,
      t.points,
      ('Points Purchase - ' || t.points || ' points')::text AS description,
      t.created_at,
      COALESCE(t.status, 'pending')::text AS status,
      NULL::text AS reason,
      NULL::text AS adjustment_type,
      t.razorpay_order_id,
      t.razorpay_payment_id,
      t.txn_id,
      NULL::jsonb AS metadata
    FROM public.transactions t
    WHERE t.user_id = p_user_id

    UNION ALL

    SELECT
      pa.id::text AS id,
      'adjustment'::text AS type,
      0 AS amount,
      CASE WHEN pa.adjustment_type = 'add' THEN abs(pa.points) ELSE -abs(pa.points) END AS points,
      COALESCE(pa.reason, 'Point Adjustment')::text AS description,
      pa.created_at,
      'completed'::text AS status,
      pa.reason,
      pa.adjustment_type,
      NULL::text AS razorpay_order_id,
      NULL::text AS razorpay_payment_id,
      NULL::text AS txn_id,
      NULL::jsonb AS metadata
    FROM public.point_adjustments pa
    WHERE pa.user_id = p_user_id

    UNION ALL

    SELECT
      jb.id::text AS id,
      'payment'::text AS type,
      jb.amount_paid AS amount,
      0 AS points,
      'Job Boost Purchase'::text AS description,
      jb.created_at,
      CASE WHEN jb.status = 'paid' THEN 'completed' ELSE jb.status END::text AS status,
      NULL::text AS reason,
      NULL::text AS adjustment_type,
      jb.razorpay_order_id,
      jb.razorpay_payment_id,
      NULL::text AS txn_id,
      NULL::jsonb AS metadata
    FROM public.job_boosts jb
    WHERE jb.user_id = p_user_id

    UNION ALL

    SELECT
      vp.id::text AS id,
      'payment'::text AS type,
      vp.amount_paid AS amount,
      0 AS points,
      'Verification Badge Purchase'::text AS description,
      vp.created_at,
      CASE WHEN vp.status = 'paid' THEN 'completed' ELSE vp.status END::text AS status,
      NULL::text AS reason,
      NULL::text AS adjustment_type,
      vp.razorpay_order_id,
      vp.razorpay_payment_id,
      NULL::text AS txn_id,
      NULL::jsonb AS metadata
    FROM public.verification_purchases vp
    WHERE vp.user_id = p_user_id
      AND NOT (vp.razorpay_payment_id IS NOT NULL AND vp.razorpay_payment_id LIKE 'wallet_%')

    UNION ALL

    SELECT
      pt.id::text AS id,
      CASE WHEN pt.metadata->>'payment_method' = 'wallet' THEN 'payment' ELSE 'adjustment' END::text AS type,
      0 AS amount,
      pt.points_amount AS points,
      pt.description,
      pt.created_at,
      CASE WHEN pt.metadata->>'status' = 'completed' THEN 'completed' ELSE 'pending' END::text AS status,
      NULL::text AS reason,
      NULL::text AS adjustment_type,
      NULL::text AS razorpay_order_id,
      NULL::text AS razorpay_payment_id,
      NULL::text AS txn_id,
      pt.metadata
    FROM public.points_transactions pt
    WHERE pt.user_id = p_user_id

    UNION ALL

    SELECT
      jp.id::text AS id,
      'payment'::text AS type,
      0 AS amount,
      -jp.points_spent AS points,
      COALESCE(jp.description, 'Job Posting')::text AS description,
      jp.created_at,
      'completed'::text AS status,
      NULL::text AS reason,
      NULL::text AS adjustment_type,
      NULL::text AS razorpay_order_id,
      NULL::text AS razorpay_payment_id,
      NULL::text AS txn_id,
      NULL::jsonb AS metadata
    FROM public.job_payments jp
    WHERE jp.user_id = p_user_id
  )
  SELECT * FROM all_transactions
  ORDER BY created_at DESC;
END;
$function$;