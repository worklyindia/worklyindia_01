-- Phase 1: Clean RLS Policies and Admin Access Enhancement
-- First drop ALL existing policies to avoid conflicts

-- Transactions table
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can manage transactions" ON public.transactions;

-- Job Boosts table
DROP POLICY IF EXISTS "Users can view their own job boosts" ON public.job_boosts;
DROP POLICY IF EXISTS "Admins can view all job boosts" ON public.job_boosts;
DROP POLICY IF EXISTS "Users can create their own job boosts" ON public.job_boosts;
DROP POLICY IF EXISTS "System can update job boosts" ON public.job_boosts;
DROP POLICY IF EXISTS "System can manage job boosts" ON public.job_boosts;

-- Verification Purchases table
DROP POLICY IF EXISTS "Users can view their own verification purchases" ON public.verification_purchases;
DROP POLICY IF EXISTS "Admins can view all verification purchases" ON public.verification_purchases;
DROP POLICY IF EXISTS "Users can create their own verification purchases" ON public.verification_purchases;
DROP POLICY IF EXISTS "System can manage verification purchases" ON public.verification_purchases;

-- Points Transactions table
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "Users can view their own points transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "Admins can view all points transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "System can manage points transactions" ON public.points_transactions;

-- Job Payments table
DROP POLICY IF EXISTS "Users can view their own job payments" ON public.job_payments;
DROP POLICY IF EXISTS "Admins can view all job payments" ON public.job_payments;
DROP POLICY IF EXISTS "Users can create their own job payments" ON public.job_payments;
DROP POLICY IF EXISTS "System can manage job payments" ON public.job_payments;

-- Wallets table
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can manage their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "System can update wallets" ON public.wallets;
DROP POLICY IF EXISTS "System can manage all wallets" ON public.wallets;

-- Now create NEW comprehensive policies

-- TRANSACTIONS TABLE
CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" 
ON public.transactions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

CREATE POLICY "System can manage transactions" 
ON public.transactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- JOB BOOSTS TABLE
CREATE POLICY "Users can view their own job boosts" 
ON public.job_boosts 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all job boosts" 
ON public.job_boosts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

CREATE POLICY "Users can create their own job boosts" 
ON public.job_boosts 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage job boosts" 
ON public.job_boosts 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- VERIFICATION PURCHASES TABLE
CREATE POLICY "Users can view their own verification purchases" 
ON public.verification_purchases 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification purchases" 
ON public.verification_purchases 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

CREATE POLICY "Users can create their own verification purchases" 
ON public.verification_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage verification purchases" 
ON public.verification_purchases 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- POINTS TRANSACTIONS TABLE
CREATE POLICY "Users can view their own points transactions" 
ON public.points_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all points transactions" 
ON public.points_transactions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

CREATE POLICY "System can manage points transactions" 
ON public.points_transactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- JOB PAYMENTS TABLE
CREATE POLICY "Users can view their own job payments" 
ON public.job_payments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all job payments" 
ON public.job_payments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

CREATE POLICY "Users can create their own job payments" 
ON public.job_payments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage job payments" 
ON public.job_payments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- WALLETS TABLE
CREATE POLICY "Users can view their own wallet" 
ON public.wallets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" 
ON public.wallets 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

CREATE POLICY "Users can manage their own wallet" 
ON public.wallets 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage all wallets" 
ON public.wallets 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create comprehensive admin wallet history function
CREATE OR REPLACE FUNCTION public.admin_get_comprehensive_wallet_history(p_user_id uuid)
RETURNS TABLE(
  id text,
  type text,
  amount integer,
  points integer,
  description text,
  created_at timestamp with time zone,
  status text,
  reason text,
  adjustment_type text,
  razorpay_order_id text,
  razorpay_payment_id text,
  txn_id text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  WITH all_transactions AS (
    -- Purchase transactions
    SELECT 
      t.id::text as id,
      'purchase'::text as type,
      t.amount,
      t.points,
      ('Points Purchase - ' || t.points || ' points')::text as description,
      t.created_at,
      COALESCE(t.status, 'pending')::text as status,
      NULL::text as reason,
      NULL::text as adjustment_type,
      t.razorpay_order_id,
      t.razorpay_payment_id,
      t.txn_id,
      NULL::jsonb as metadata
    FROM public.transactions t
    WHERE t.user_id = p_user_id

    UNION ALL

    -- Point adjustments
    SELECT 
      pa.id::text as id,
      'adjustment'::text as type,
      0 as amount,
      CASE WHEN pa.adjustment_type = 'add' THEN pa.points ELSE -pa.points END as points,
      COALESCE(pa.reason, 'Point Adjustment')::text as description,
      pa.created_at,
      'completed'::text as status,
      pa.reason,
      pa.adjustment_type,
      NULL::text as razorpay_order_id,
      NULL::text as razorpay_payment_id,
      NULL::text as txn_id,
      NULL::jsonb as metadata
    FROM public.point_adjustments pa
    WHERE pa.user_id = p_user_id

    UNION ALL

    -- Job boost purchases
    SELECT 
      jb.id::text as id,
      'payment'::text as type,
      jb.amount_paid as amount,
      0 as points,
      'Job Boost Purchase'::text as description,
      jb.created_at,
      CASE WHEN jb.status = 'paid' THEN 'completed' ELSE jb.status END::text as status,
      NULL::text as reason,
      NULL::text as adjustment_type,
      jb.razorpay_order_id,
      jb.razorpay_payment_id,
      NULL::text as txn_id,
      NULL::jsonb as metadata
    FROM public.job_boosts jb
    WHERE jb.user_id = p_user_id

    UNION ALL

    -- Verification purchases (exclude wallet-based to avoid duplicates)
    SELECT 
      vp.id::text as id,
      'payment'::text as type,
      vp.amount_paid as amount,
      0 as points,
      'Verification Badge Purchase'::text as description,
      vp.created_at,
      CASE WHEN vp.status = 'paid' THEN 'completed' ELSE vp.status END::text as status,
      NULL::text as reason,
      NULL::text as adjustment_type,
      vp.razorpay_order_id,
      vp.razorpay_payment_id,
      NULL::text as txn_id,
      NULL::jsonb as metadata
    FROM public.verification_purchases vp
    WHERE vp.user_id = p_user_id
      AND NOT (vp.razorpay_payment_id IS NOT NULL AND vp.razorpay_payment_id LIKE 'wallet_%')

    UNION ALL

    -- Points transactions (wallet payments)
    SELECT 
      pt.id::text as id,
      CASE 
        WHEN pt.metadata->>'payment_method' = 'wallet' AND pt.transaction_type = 'spend' THEN 'payment'
        WHEN pt.metadata->>'payment_method' = 'wallet' THEN 'payment'
        ELSE 'adjustment'
      END::text as type,
      0 as amount,
      pt.points_amount as points,
      pt.description,
      pt.created_at,
      CASE WHEN pt.metadata->>'status' = 'completed' THEN 'completed' ELSE 'pending' END::text as status,
      NULL::text as reason,
      NULL::text as adjustment_type,
      NULL::text as razorpay_order_id,
      NULL::text as razorpay_payment_id,
      NULL::text as txn_id,
      pt.metadata
    FROM public.points_transactions pt
    WHERE pt.user_id = p_user_id

    UNION ALL

    -- Job payments (legacy)
    SELECT 
      jp.id::text as id,
      'payment'::text as type,
      0 as amount,
      -jp.points_spent as points,
      COALESCE(jp.description, 'Job Posting')::text as description,
      jp.created_at,
      'completed'::text as status,
      NULL::text as reason,
      NULL::text as adjustment_type,
      NULL::text as razorpay_order_id,
      NULL::text as razorpay_payment_id,
      NULL::text as txn_id,
      NULL::jsonb as metadata
    FROM public.job_payments jp
    WHERE jp.user_id = p_user_id
  )
  SELECT * FROM all_transactions
  ORDER BY created_at DESC;
END;
$function$;