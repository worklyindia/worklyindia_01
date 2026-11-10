-- ============================================================================
-- FIX 1: admin_delete_company_complete function conflict
-- Problem: Multiple function signatures exist causing PostgreSQL ambiguity
-- Solution: Drop all signatures and create single consistent function
-- ============================================================================

-- Drop all existing function signatures to avoid conflicts
DROP FUNCTION IF EXISTS public.admin_delete_company_complete(uuid);
DROP FUNCTION IF EXISTS public.admin_delete_company_complete(uuid, text);
DROP FUNCTION IF EXISTS public.admin_delete_company_complete(uuid, uuid);
DROP FUNCTION IF EXISTS public.admin_delete_company_complete(uuid, uuid, text);

-- Recreate with single consistent signature
CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_data jsonb := '{}';
  company_record RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete company profiles';
  END IF;

  -- Get company info first
  SELECT id, company_name, user_id INTO company_record
  FROM companies 
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;

  -- Delete related data in proper order (respecting foreign keys)
  
  -- Delete jobs and related data
  DELETE FROM job_applications WHERE job_id IN (SELECT id FROM jobs WHERE employer_id = target_user_id);
  DELETE FROM saved_jobs WHERE job_id IN (SELECT id FROM jobs WHERE employer_id = target_user_id);
  DELETE FROM job_views WHERE job_id IN (SELECT id FROM jobs WHERE employer_id = target_user_id);
  DELETE FROM jobs WHERE employer_id = target_user_id;
  
  -- Delete interviews
  DELETE FROM interviews WHERE host_user_id = target_user_id;
  
  -- Delete conversations and messages
  DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE employer_id = target_user_id);
  DELETE FROM conversations WHERE employer_id = target_user_id;
  
  -- Delete employer-specific data
  DELETE FROM employer_settings WHERE user_id = target_user_id;
  DELETE FROM employer_notifications WHERE user_id = target_user_id;
  DELETE FROM employer_metrics WHERE user_id = target_user_id;
  DELETE FROM employer_profile_drafts WHERE user_id = target_user_id;
  
  -- Delete company related data
  DELETE FROM company_reviews WHERE company_id = company_record.id;
  DELETE FROM company_favorites WHERE company_id = company_record.id;
  DELETE FROM company_interactions WHERE company_id = company_record.id;
  DELETE FROM company_statistics WHERE company_id = company_record.id;
  
  -- Delete the company profile
  DELETE FROM companies WHERE user_id = target_user_id;
  
  -- Delete wallet data
  DELETE FROM point_adjustments WHERE user_id = target_user_id;
  DELETE FROM wallet_transactions WHERE user_id = target_user_id;
  DELETE FROM wallets WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    auth.uid()::text,
    'delete_company_complete',
    'company',
    company_record.id::text,
    jsonb_build_object(
      'company_name', company_record.company_name,
      'user_id', target_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_company', company_record.company_name,
    'user_id', target_user_id
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_delete_company_complete(uuid) TO authenticated;

-- ============================================================================
-- FIX 2: adjust_wallet_points double credit bug
-- Problem: Function updates wallet AND inserts adjustment (which triggers another update)
-- Solution: Only insert adjustment record, let trigger handle wallet update
-- ============================================================================

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

  -- ONLY insert the adjustment record
  -- The trigger on point_adjustments table will handle the wallet balance update
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

  -- DO NOT update wallet here - the trigger will do it!
  -- This was the bug: we were updating twice (here + trigger)

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