-- Harden wallet balance functions and add admin getter
-- Ensure functions run in public schema and are safe

CREATE OR REPLACE FUNCTION public.update_wallet_balance(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    calculated_balance INTEGER;
BEGIN
    -- Calculate total balance from all sources
    SELECT COALESCE(
        (SELECT SUM(points) FROM public.transactions 
         WHERE user_id = target_user_id AND status IN ('success','completed')),
        0
    ) + COALESCE(
        (SELECT SUM(CASE WHEN adjustment_type = 'add' THEN points ELSE -points END) 
         FROM public.point_adjustments WHERE user_id = target_user_id),
        0
    ) - COALESCE(
        (SELECT SUM(points_spent) FROM public.job_payments WHERE user_id = target_user_id),
        0
    ) - COALESCE(
        (SELECT SUM(ABS(points_amount)) FROM public.points_transactions 
         WHERE user_id = target_user_id AND points_amount < 0),
        0
    ) INTO calculated_balance;

    IF calculated_balance < 0 THEN
        calculated_balance := 0;
    END IF;

    INSERT INTO public.wallets (user_id, balance_points, updated_at)
    VALUES (target_user_id, calculated_balance, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance_points = calculated_balance,
        updated_at = NOW();

    RETURN calculated_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.update_wallet_balance(OLD.user_id);
        RETURN OLD;
    ELSE
        PERFORM public.update_wallet_balance(NEW.user_id);
        RETURN NEW;
    END IF;
END;
$$;

-- Admin-only function to read any user's wallet balance
CREATE OR REPLACE FUNCTION public.admin_get_wallet_balance(p_user_id uuid)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Only admins/owners can use this
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin','owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT COALESCE(balance_points, 0) INTO v_balance
  FROM public.wallets WHERE user_id = p_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;