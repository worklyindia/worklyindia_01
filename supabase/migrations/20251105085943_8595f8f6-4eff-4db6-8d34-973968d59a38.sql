-- Fix Owner Analytics Functions - Complete Rebuild
-- This migration fixes all analytics functions to return correct data structures

-- =====================================================
-- 1. FIX get_owner_overview_statistics
-- =====================================================
DROP FUNCTION IF EXISTS get_owner_overview_statistics();

CREATE OR REPLACE FUNCTION get_owner_overview_statistics()
RETURNS TABLE (
  total_members BIGINT,
  active_members BIGINT,
  inactive_members BIGINT,
  total_companies BIGINT,
  verified_companies BIGINT,
  active_companies BIGINT,
  banned_companies BIGINT,
  profile_complete_percentage NUMERIC
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  RETURN QUERY
  SELECT 
    -- Total members from profiles table
    (SELECT COUNT(*) FROM profiles)::BIGINT as total_members,
    
    -- Active members (logged in within 30 days)
    (SELECT COUNT(*) 
     FROM profiles p
     WHERE p.last_login_at >= NOW() - INTERVAL '30 days')::BIGINT as active_members,
    
    -- Inactive members (not logged in for 30+ days or never logged in)
    (SELECT COUNT(*) 
     FROM profiles p
     WHERE p.last_login_at < NOW() - INTERVAL '30 days' 
        OR p.last_login_at IS NULL)::BIGINT as inactive_members,
    
    -- Total companies
    (SELECT COUNT(*) FROM companies)::BIGINT as total_companies,
    
    -- Verified companies
    (SELECT COUNT(*) FROM companies WHERE verified = true)::BIGINT as verified_companies,
    
    -- Active companies (with at least one active job)
    (SELECT COUNT(DISTINCT company_id) 
     FROM jobs 
     WHERE status = 'active')::BIGINT as active_companies,
    
    -- Banned companies
    (SELECT COUNT(*) FROM companies WHERE banned = true)::BIGINT as banned_companies,
    
    -- Profile completion percentage
    (SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE profile_complete = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      END
     FROM profiles)::NUMERIC as profile_complete_percentage;
END;
$$;

-- =====================================================
-- 2. FIX get_user_location_statistics
-- =====================================================
DROP FUNCTION IF EXISTS get_user_location_statistics();

CREATE OR REPLACE FUNCTION get_user_location_statistics()
RETURNS TABLE (
  country TEXT,
  state TEXT,
  city TEXT,
  total_members BIGINT,
  active_members BIGINT,
  profile_complete_members BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(p.country, 'Unknown')::TEXT as country,
    COALESCE(p.state, 'Unknown')::TEXT as state,
    COALESCE(p.city, 'Unknown')::TEXT as city,
    COUNT(*)::BIGINT as total_members,
    COUNT(*) FILTER (WHERE p.last_login_at >= NOW() - INTERVAL '30 days')::BIGINT as active_members,
    COUNT(*) FILTER (WHERE p.profile_complete = true)::BIGINT as profile_complete_members
  FROM profiles p
  GROUP BY p.country, p.state, p.city
  ORDER BY total_members DESC;
END;
$$;

-- =====================================================
-- 3. FIX get_financial_statistics
-- =====================================================
DROP FUNCTION IF EXISTS get_financial_statistics();

CREATE OR REPLACE FUNCTION get_financial_statistics()
RETURNS TABLE (
  total_wallet_points NUMERIC,
  total_wallet_purchased NUMERIC,
  total_wallet_spent NUMERIC,
  total_referral_balance NUMERIC,
  total_referral_earned NUMERIC,
  total_referral_withdrawn NUMERIC,
  total_users_with_wallet BIGINT,
  total_users_with_referral BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(w.wallet_balance), 0)::NUMERIC as total_wallet_points,
    COALESCE(SUM(w.wallet_purchased), 0)::NUMERIC as total_wallet_purchased,
    COALESCE(SUM(w.wallet_spent), 0)::NUMERIC as total_wallet_spent,
    COALESCE(SUM(w.referral_balance), 0)::NUMERIC as total_referral_balance,
    COALESCE(SUM(w.referral_earned), 0)::NUMERIC as total_referral_earned,
    COALESCE(SUM(w.referral_withdrawn), 0)::NUMERIC as total_referral_withdrawn,
    COUNT(*) FILTER (WHERE w.wallet_balance > 0 OR w.wallet_purchased > 0 OR w.wallet_spent > 0)::BIGINT as total_users_with_wallet,
    COUNT(*) FILTER (WHERE w.referral_balance > 0 OR w.referral_earned > 0 OR w.referral_withdrawn > 0)::BIGINT as total_users_with_referral
  FROM wallets w;
END;
$$;

-- =====================================================
-- 4. FIX get_financial_statistics_by_period
-- =====================================================
DROP FUNCTION IF EXISTS get_financial_statistics_by_period(TEXT);

CREATE OR REPLACE FUNCTION get_financial_statistics_by_period(p_period TEXT)
RETURNS TABLE (
  total_wallet_points NUMERIC,
  total_wallet_purchased NUMERIC,
  total_wallet_spent NUMERIC,
  total_referral_balance NUMERIC,
  total_referral_earned NUMERIC,
  total_referral_withdrawn NUMERIC,
  total_users_with_wallet BIGINT,
  total_users_with_referral BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  start_date TIMESTAMP;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  -- Calculate start date based on period
  CASE p_period
    WHEN 'today' THEN
      start_date := DATE_TRUNC('day', NOW());
    WHEN 'week' THEN
      start_date := DATE_TRUNC('week', NOW());
    WHEN 'month' THEN
      start_date := DATE_TRUNC('month', NOW());
    WHEN 'year' THEN
      start_date := DATE_TRUNC('year', NOW());
    ELSE
      start_date := DATE_TRUNC('day', NOW());
  END CASE;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(w.wallet_balance), 0)::NUMERIC as total_wallet_points,
    COALESCE(SUM(w.wallet_purchased), 0)::NUMERIC as total_wallet_purchased,
    COALESCE(SUM(w.wallet_spent), 0)::NUMERIC as total_wallet_spent,
    COALESCE(SUM(w.referral_balance), 0)::NUMERIC as total_referral_balance,
    COALESCE(SUM(w.referral_earned), 0)::NUMERIC as total_referral_earned,
    COALESCE(SUM(w.referral_withdrawn), 0)::NUMERIC as total_referral_withdrawn,
    COUNT(*) FILTER (WHERE w.wallet_balance > 0 OR w.wallet_purchased > 0 OR w.wallet_spent > 0)::BIGINT as total_users_with_wallet,
    COUNT(*) FILTER (WHERE w.referral_balance > 0 OR w.referral_earned > 0 OR w.referral_withdrawn > 0)::BIGINT as total_users_with_referral
  FROM wallets w
  WHERE w.created_at >= start_date;
END;
$$;

-- Grant execute permissions to authenticated users (admin check is inside functions)
GRANT EXECUTE ON FUNCTION get_owner_overview_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_location_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_statistics_by_period(TEXT) TO authenticated;