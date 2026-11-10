-- ============================================================================
-- FIX 1: Create missing saved_jobs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- Enable RLS
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved jobs" ON public.saved_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save jobs" ON public.saved_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave jobs" ON public.saved_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Admin can view all
CREATE POLICY "Admins can view all saved jobs" ON public.saved_jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- ============================================================================
-- FIX 2: Drop ALL adjust_wallet_points function signatures and recreate ONE
-- ============================================================================

-- Drop all possible signatures
DROP FUNCTION IF EXISTS public.adjust_wallet_points(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.adjust_wallet_points(uuid, integer, text, text, text);
DROP FUNCTION IF EXISTS public.adjust_wallet_points(p_user_id uuid, p_points integer, p_adjustment_type text, p_reason text);
DROP FUNCTION IF EXISTS public.adjust_wallet_points(p_user_id uuid, p_points integer, p_adjustment_type text, p_reason text, p_admin_note text);

-- Create single function with all optional parameters having defaults
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

  -- Calculate new balance
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

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'points_adjusted', p_points
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.adjust_wallet_points(uuid, integer, text, text, text) TO authenticated;