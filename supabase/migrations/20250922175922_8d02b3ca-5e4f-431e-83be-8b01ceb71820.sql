-- Create trigger function for new referral notifications
CREATE OR REPLACE FUNCTION public.send_referral_join_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    referrer_name TEXT;
    referred_name TEXT;
BEGIN
    -- Get referrer and referred user names
    SELECT COALESCE(p.full_name, 'Someone') INTO referrer_name
    FROM profiles p WHERE p.user_id = NEW.referrer_id;
    
    SELECT COALESCE(p.full_name, 'New User') INTO referred_name  
    FROM profiles p WHERE p.user_id = NEW.referred_user_id;

    -- Send notification to referrer about new referral
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        NEW.referrer_id,
        '🎉 New Referral Joined!',
        referred_name || ' joined using your referral code! You''ll earn commission on their purchases.',
        'success',
        '/employer/referral',
        jsonb_build_object(
            'type', 'referral_join',
            'referred_user_id', NEW.referred_user_id,
            'referral_id', NEW.id
        )
    );

    -- Send welcome notification to referred user
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        NEW.referred_user_id,
        '🎁 Welcome! Referral Bonus Applied',
        'Welcome to Workly India! You joined via ' || referrer_name || '''s referral. Enjoy exclusive benefits!',
        'success',
        '/rewards',
        jsonb_build_object(
            'type', 'referral_welcome',
            'referrer_id', NEW.referrer_id,
            'referral_id', NEW.id
        )
    );

    -- Send push notifications via edge function
    PERFORM net.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-referral-notifications',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', current_setting('app.settings.api_external_url', true)
        ),
        body := jsonb_build_object(
            'event_type', 'referral_join',
            'referrer_id', NEW.referrer_id,
            'referred_user_id', NEW.referred_user_id,
            'referrer_name', referrer_name,
            'referred_name', referred_name
        )
    );

    RETURN NEW;
END;
$$;

-- Create trigger function for commission notifications
CREATE OR REPLACE FUNCTION public.send_commission_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    referrer_name TEXT;
    total_commissions NUMERIC;
BEGIN
    -- Get referrer name
    SELECT COALESCE(p.full_name, 'User') INTO referrer_name
    FROM profiles p WHERE p.user_id = NEW.referrer_id;
    
    -- Calculate total commissions earned
    SELECT COALESCE(SUM(commission_amount), 0) INTO total_commissions
    FROM referral_commissions 
    WHERE referrer_id = NEW.referrer_id AND status = 'completed';

    -- Send commission notification
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        NEW.referrer_id,
        '💰 Commission Earned!',
        'You earned ₹' || NEW.commission_amount || ' commission! Total earned: ₹' || total_commissions,
        'success',
        '/employer/referral',
        jsonb_build_object(
            'type', 'commission_earned',
            'commission_id', NEW.id,
            'amount', NEW.commission_amount,
            'total_earned', total_commissions
        )
    );

    -- Send push notification for commission
    PERFORM net.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-referral-notifications',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', current_setting('app.settings.api_external_url', true)
        ),
        body := jsonb_build_object(
            'event_type', 'commission_earned',
            'referrer_id', NEW.referrer_id,
            'commission_amount', NEW.commission_amount,
            'total_commissions', total_commissions,
            'referrer_name', referrer_name
        )
    );

    RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS on_user_referral_created ON user_referrals;
CREATE TRIGGER on_user_referral_created
    AFTER INSERT ON user_referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.send_referral_join_notification();

DROP TRIGGER IF EXISTS on_commission_status_updated ON referral_commissions;
CREATE TRIGGER on_commission_status_updated
    AFTER UPDATE ON referral_commissions
    FOR EACH ROW
    WHEN (OLD.status != NEW.status AND NEW.status = 'completed')
    EXECUTE FUNCTION public.send_commission_notification();

-- Create function for referral milestones
CREATE OR REPLACE FUNCTION public.check_referral_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    referral_count INTEGER;
    milestone_reached INTEGER;
BEGIN
    -- Count total referrals for user
    SELECT COUNT(*) INTO referral_count
    FROM user_referrals 
    WHERE referrer_id = NEW.referrer_id AND is_active = true;

    -- Check for milestone achievements
    IF referral_count IN (1, 5, 10, 25, 50, 100) THEN
        milestone_reached := referral_count;
        
        -- Send milestone notification
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            action_url,
            metadata
        ) VALUES (
            NEW.referrer_id,
            '🏆 Referral Milestone Achieved!',
            'Congratulations! You''ve reached ' || milestone_reached || ' referrals! Keep sharing to earn more.',
            'success',
            '/employer/referral',
            jsonb_build_object(
                'type', 'referral_milestone',
                'milestone', milestone_reached,
                'total_referrals', referral_count
            )
        );

        -- Send milestone push notification
        PERFORM net.http_post(
            url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-referral-notifications',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', current_setting('app.settings.api_external_url', true)
            ),
            body := jsonb_build_object(
                'event_type', 'milestone_achieved',
                'referrer_id', NEW.referrer_id,
                'milestone', milestone_reached,
                'total_referrals', referral_count
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Create milestone trigger
DROP TRIGGER IF EXISTS on_referral_milestone_check ON user_referrals;
CREATE TRIGGER on_referral_milestone_check
    AFTER INSERT ON user_referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.check_referral_milestones();