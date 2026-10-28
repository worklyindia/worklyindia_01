DROP TRIGGER IF EXISTS trg_new_referral_join ON public.user_referrals;

CREATE OR REPLACE FUNCTION public.send_referral_join_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    referrer_name TEXT;
    referred_name TEXT;
BEGIN
    SELECT COALESCE(p.full_name, 'Someone') INTO referrer_name
    FROM profiles p WHERE p.user_id = NEW.referrer_id;

    SELECT COALESCE(p.full_name, 'New User') INTO referred_name
    FROM profiles p WHERE p.user_id = NEW.referred_user_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
    VALUES (
        NEW.referrer_id,
        '🎉 New Referral Joined!',
        COALESCE(referred_name, 'New User') || ' joined using your referral code! You''ll earn commission on their purchases.',
        'success',
        '/referral-activity',
        jsonb_build_object('type', 'referral_join', 'referred_user_id', NEW.referred_user_id, 'referral_id', NEW.id)
    );

    INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
    VALUES (
        NEW.referred_user_id,
        '🎁 Welcome! Referral Bonus Applied',
        'Welcome to Workly India! You joined via ' || COALESCE(referrer_name, 'a friend') || '''s referral. Enjoy exclusive benefits!',
        'success',
        '/rewards',
        jsonb_build_object('type', 'referral_welcome', 'referrer_id', NEW.referrer_id, 'referral_id', NEW.id)
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'send_referral_join_notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;