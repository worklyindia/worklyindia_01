DO $$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('admin_delete_website_user_data','get_financial_statistics','get_financial_statistics_by_period','ensure_single_most_popular')
  LOOP
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, 'DELETE FROM (public\.)?(user_points|wallets) WHERE user_id = target_user_id;\s*GET DIAGNOSTICS v_count = ROW_COUNT;\s*[a-z_]+ := [a-z_]+ \|\| jsonb_build_object\(''(user_points|wallets)'', v_count\);', '', 'g');
    d := regexp_replace(d, 'ELSIF TG_TABLE_NAME = ''points_packages'' THEN\s*UPDATE points_packages SET most_popular = false WHERE id != NEW.id;', '', 'g');
    d := replace(d, 'FROM public.wallets w', 'FROM (SELECT NULL::uuid AS user_id, 0::bigint AS balance_points, 0::bigint AS total_purchased, 0::bigint AS total_spent WHERE false) w');
    d := replace(d, '(SELECT SUM(balance_points)::BIGINT FROM public.wallets)', '0::bigint');
    d := replace(d, '(SELECT COUNT(*)::BIGINT FROM public.wallets)', '0::bigint');
    d := replace(d, 'FROM public.points_transactions', 'FROM (SELECT 0::bigint AS points_amount, NULL::text AS transaction_type, NULL::timestamptz AS created_at WHERE false) pt');
    EXECUTE d;
  END LOOP;

  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('add_wallet_points_secure','adjust_wallet_points','admin_get_comprehensive_wallet_history','admin_get_wallet_balance','deduct_wallet_points_atomic','deduct_wallet_points_secure','expire_old_points','increment_wallet_points','increment_wallet_points_secure','update_wallet_balance')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.point_adjustments CASCADE;
DROP TABLE IF EXISTS public.points_transactions CASCADE;
DROP TABLE IF EXISTS public.points_packages CASCADE;
DROP TABLE IF EXISTS public.user_points CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;