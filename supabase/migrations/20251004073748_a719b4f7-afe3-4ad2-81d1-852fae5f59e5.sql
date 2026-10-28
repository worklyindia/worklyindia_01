-- Function to get user statistics by country and state
CREATE OR REPLACE FUNCTION public.get_user_location_statistics()
RETURNS TABLE (
  country TEXT,
  state TEXT,
  total_members BIGINT,
  active_members BIGINT,
  profile_complete_members BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(p.country, 'Unknown') as country,
    COALESCE(p.state, 'Unknown') as state,
    COUNT(*)::BIGINT as total_members,
    COUNT(*) FILTER (WHERE p.account_status = 'active')::BIGINT as active_members,
    COUNT(*) FILTER (WHERE p.is_profile_complete = true)::BIGINT as profile_complete_members
  FROM public.profiles p
  GROUP BY p.country, p.state
  ORDER BY total_members DESC, country, state;
END;
$$;

-- Function to get login activity statistics
CREATE OR REPLACE FUNCTION public.get_login_activity_statistics(
  p_period TEXT DEFAULT 'today'
)
RETURNS TABLE (
  period_date DATE,
  total_logins BIGINT,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMP;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Set start date based on period
  CASE p_period
    WHEN 'today' THEN
      v_start_date := DATE_TRUNC('day', NOW());
    WHEN '7days' THEN
      v_start_date := NOW() - INTERVAL '7 days';
    WHEN '30days' THEN
      v_start_date := NOW() - INTERVAL '30 days';
    WHEN '6months' THEN
      v_start_date := NOW() - INTERVAL '6 months';
    WHEN '1year' THEN
      v_start_date := NOW() - INTERVAL '1 year';
    ELSE
      v_start_date := DATE_TRUNC('day', NOW());
  END CASE;

  RETURN QUERY
  SELECT 
    DATE(au.last_sign_in_at) as period_date,
    COUNT(*)::BIGINT as total_logins,
    COUNT(DISTINCT au.id)::BIGINT as unique_users
  FROM auth.users au
  WHERE au.last_sign_in_at >= v_start_date
    AND au.last_sign_in_at IS NOT NULL
  GROUP BY DATE(au.last_sign_in_at)
  ORDER BY period_date DESC;
END;
$$;

-- Function to get new account creation statistics
CREATE OR REPLACE FUNCTION public.get_new_accounts_statistics(
  p_period TEXT DEFAULT 'today'
)
RETURNS TABLE (
  period_date DATE,
  jobseeker_accounts BIGINT,
  employer_accounts BIGINT,
  total_new_accounts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMP;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Set start date based on period
  CASE p_period
    WHEN 'today' THEN
      v_start_date := DATE_TRUNC('day', NOW());
    WHEN '7days' THEN
      v_start_date := NOW() - INTERVAL '7 days';
    WHEN '30days' THEN
      v_start_date := NOW() - INTERVAL '30 days';
    WHEN '6months' THEN
      v_start_date := NOW() - INTERVAL '6 months';
    WHEN '1year' THEN
      v_start_date := NOW() - INTERVAL '1 year';
    ELSE
      v_start_date := DATE_TRUNC('day', NOW());
  END CASE;

  RETURN QUERY
  SELECT 
    DATE(p.created_at) as period_date,
    COUNT(p.user_id) FILTER (WHERE c.user_id IS NULL)::BIGINT as jobseeker_accounts,
    COUNT(DISTINCT c.user_id)::BIGINT as employer_accounts,
    COUNT(DISTINCT p.user_id)::BIGINT as total_new_accounts
  FROM public.profiles p
  LEFT JOIN public.companies c ON c.user_id = p.user_id
  WHERE p.created_at >= v_start_date
  GROUP BY DATE(p.created_at)
  ORDER BY period_date DESC;
END;
$$;

-- Function to get financial statistics
CREATE OR REPLACE FUNCTION public.get_financial_statistics()
RETURNS TABLE (
  total_wallet_points BIGINT,
  total_wallet_purchased BIGINT,
  total_wallet_spent BIGINT,
  total_referral_balance NUMERIC,
  total_referral_earned NUMERIC,
  total_referral_withdrawn NUMERIC,
  total_users_with_wallet BIGINT,
  total_users_with_referral BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(w.balance_points), 0)::BIGINT as total_wallet_points,
    COALESCE(SUM(w.total_purchased), 0)::BIGINT as total_wallet_purchased,
    COALESCE(SUM(w.total_spent), 0)::BIGINT as total_wallet_spent,
    COALESCE(SUM(rw.balance_amount), 0)::NUMERIC as total_referral_balance,
    COALESCE(SUM(rw.total_earned), 0)::NUMERIC as total_referral_earned,
    COALESCE(SUM(rw.total_withdrawn), 0)::NUMERIC as total_referral_withdrawn,
    COUNT(DISTINCT w.user_id)::BIGINT as total_users_with_wallet,
    COUNT(DISTINCT rw.user_id)::BIGINT as total_users_with_referral
  FROM public.wallets w
  FULL OUTER JOIN public.referral_wallets rw ON w.user_id = rw.user_id;
END;
$$;

-- Function to get overview statistics
CREATE OR REPLACE FUNCTION public.get_owner_overview_statistics()
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(DISTINCT p.user_id)::BIGINT as total_members,
    COUNT(DISTINCT p.user_id) FILTER (WHERE p.account_status = 'active')::BIGINT as active_members,
    COUNT(DISTINCT p.user_id) FILTER (WHERE p.account_status != 'active')::BIGINT as inactive_members,
    COUNT(DISTINCT c.id)::BIGINT as total_companies,
    COUNT(DISTINCT c.id) FILTER (WHERE c.is_verified = true)::BIGINT as verified_companies,
    COUNT(DISTINCT c.id) FILTER (WHERE c.account_status = 'active')::BIGINT as active_companies,
    COUNT(DISTINCT c.id) FILTER (WHERE c.account_status = 'banned')::BIGINT as banned_companies,
    CASE 
      WHEN COUNT(DISTINCT p.user_id) > 0 THEN
        ROUND((COUNT(DISTINCT p.user_id) FILTER (WHERE p.is_profile_complete = true)::NUMERIC / COUNT(DISTINCT p.user_id)::NUMERIC * 100), 2)
      ELSE 0
    END as profile_complete_percentage
  FROM public.profiles p
  LEFT JOIN public.companies c ON true;
END;
$$;