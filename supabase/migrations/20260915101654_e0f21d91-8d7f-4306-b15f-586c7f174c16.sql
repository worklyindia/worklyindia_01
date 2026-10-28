
-- Shared helper: in-app notification + push
CREATE OR REPLACE FUNCTION public.send_referral_push(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_action_url text,
  p_data jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, action_url, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_action_url, p_data);

  SELECT value INTO v_secret FROM public.app_secrets WHERE key = 'points_notify_secret';
  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
      'x-points-trigger-secret', v_secret
    ),
    body := jsonb_build_object(
      'action', 'send_push',
      'user_id', p_user_id,
      'title', p_title,
      'message', p_message,
      'action_url', p_action_url,
      'button_text', 'View Referrals',
      'skip_rephrase', true,
      'data', p_data
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'send_referral_push failed: %', SQLERRM;
END;
$$;

-- 1) Wallet credited
CREATE OR REPLACE FUNCTION public.notify_referral_wallet_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_diff numeric;
BEGIN
  v_diff := COALESCE(NEW.balance_amount,0) - COALESCE(OLD.balance_amount,0);
  IF v_diff > 0 THEN
    PERFORM public.send_referral_push(
      NEW.user_id,
      '💰 Wallet Credited',
      '₹' || trim(to_char(v_diff, 'FM999999990.00')) || ' added to your referral wallet. New balance: ₹' || trim(to_char(COALESCE(NEW.balance_amount,0), 'FM999999990.00')),
      'referral',
      '/referral',
      jsonb_build_object('type','referral_wallet_credit','amount',v_diff,'balance',NEW.balance_amount)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_referral_wallet_credit failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_wallet_credit ON public.referral_wallets;
CREATE TRIGGER trg_referral_wallet_credit
AFTER UPDATE OF balance_amount ON public.referral_wallets
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_wallet_credit();

-- 2) Withdrawal status
CREATE OR REPLACE FUNCTION public.notify_referral_withdrawal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
  v_msg text;
  v_amt text := '₹' || trim(to_char(COALESCE(NEW.amount,0), 'FM999999990.00'));
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := '⏳ Withdrawal Requested';
    v_msg := 'Your withdrawal request of ' || v_amt || ' has been received and is being reviewed.';
  ELSE
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
    CASE lower(NEW.status)
      WHEN 'approved' THEN v_title := '✅ Withdrawal Approved'; v_msg := 'Your withdrawal of ' || v_amt || ' has been approved.';
      WHEN 'processing' THEN v_title := '🔄 Withdrawal Processing'; v_msg := 'Your withdrawal of ' || v_amt || ' is being processed.';
      WHEN 'paid' THEN v_title := '🎉 Withdrawal Paid'; v_msg := v_amt || ' has been sent to your payment account.';
      WHEN 'completed' THEN v_title := '🎉 Withdrawal Completed'; v_msg := v_amt || ' has been sent to your payment account.';
      WHEN 'rejected' THEN v_title := '⚠️ Withdrawal Rejected'; v_msg := 'Your withdrawal of ' || v_amt || ' was rejected. ' || COALESCE(NEW.failure_reason, '');
      WHEN 'failed' THEN v_title := '⚠️ Withdrawal Failed'; v_msg := 'Your withdrawal of ' || v_amt || ' failed. ' || COALESCE(NEW.failure_reason, '');
      WHEN 'cancelled' THEN v_title := '⚠️ Withdrawal Cancelled'; v_msg := 'Your withdrawal of ' || v_amt || ' was cancelled.';
      ELSE v_title := 'Withdrawal Update'; v_msg := 'Your withdrawal of ' || v_amt || ' is now ' || NEW.status || '.';
    END CASE;
  END IF;

  PERFORM public.send_referral_push(
    NEW.user_id, v_title, v_msg, 'referral', '/referral',
    jsonb_build_object('type','referral_withdrawal_update','withdrawal_id',NEW.id,'status',NEW.status,'amount',NEW.amount)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_referral_withdrawal_status failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_withdrawal_status ON public.referral_withdrawal_requests;
CREATE TRIGGER trg_referral_withdrawal_status
AFTER INSERT OR UPDATE OF status ON public.referral_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_withdrawal_status();

-- 3) New referred user joined
CREATE OR REPLACE FUNCTION public.notify_new_referral_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_total int;
BEGIN
  SELECT NULLIF(trim(p.full_name), '') INTO v_name
  FROM public.profiles p
  WHERE p.user_id = NEW.referred_user_id OR p.id = NEW.referred_user_id
  LIMIT 1;

  SELECT count(*) INTO v_total FROM public.user_referrals WHERE referrer_id = NEW.referrer_id;

  PERFORM public.send_referral_push(
    NEW.referrer_id,
    '🎉 New Referral Joined',
    COALESCE(v_name, 'Someone') || ' joined using your referral code. Total referrals: ' || COALESCE(v_total, 1) || '.',
    'referral',
    '/referral-activity',
    jsonb_build_object('type','referral_joined','referred_user_id',NEW.referred_user_id,'total_referrals',v_total)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_new_referral_join failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_referral_join ON public.user_referrals;
CREATE TRIGGER trg_new_referral_join
AFTER INSERT ON public.user_referrals
FOR EACH ROW EXECUTE FUNCTION public.notify_new_referral_join();

-- 4) Monthly competition win
CREATE OR REPLACE FUNCTION public.notify_referral_competition_win()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amt text;
BEGIN
  IF COALESCE(NEW.prize_won, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.prize_won, 0) = COALESCE(NEW.prize_won, 0) THEN
    RETURN NEW;
  END IF;

  v_amt := '₹' || trim(to_char(NEW.prize_won, 'FM999999990.00'));

  PERFORM public.send_referral_push(
    NEW.user_id,
    '🏆 You Won the Referral Competition!',
    'Congratulations! You ranked #' || COALESCE(NEW.rank, 0) || ' this month and won ' || v_amt || '. Prize will be credited to your referral wallet.',
    'referral',
    '/referral',
    jsonb_build_object('type','referral_competition_win','rank',NEW.rank,'prize',NEW.prize_won,'cycle_id',NEW.cycle_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_referral_competition_win failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_competition_win ON public.referral_competition_leaderboard;
CREATE TRIGGER trg_referral_competition_win
AFTER INSERT OR UPDATE OF prize_won ON public.referral_competition_leaderboard
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_competition_win();
