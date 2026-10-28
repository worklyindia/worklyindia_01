-- Fix schema error by updating trigger function to use net.http_post instead of non-existent supabase.http_post
CREATE OR REPLACE FUNCTION public.send_comprehensive_wallet_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    notification_title TEXT;
    notification_message TEXT;
    transaction_type TEXT;
    user_uuid UUID;
    amount_value INTEGER;
    points_value INTEGER;
BEGIN
    -- Determine transaction details based on table
    IF TG_TABLE_NAME = 'transactions' THEN
        user_uuid := NEW.user_id;
        amount_value := NEW.amount;
        points_value := NEW.points;
        transaction_type := 'purchase';
        
        IF NEW.status = 'success' THEN
            notification_title := 'Payment Successful!';
            notification_message := 'Great! ' || NEW.points || ' points have been added to your wallet.';
        ELSIF NEW.status = 'failed' THEN
            notification_title := 'Payment Failed';
            notification_message := 'Your payment of ₹' || NEW.amount || ' could not be processed. Please try again.';
        ELSIF NEW.status = 'pending' THEN
            notification_title := 'Payment Processing';
            notification_message := 'Your payment of ₹' || NEW.amount || ' is being processed.';
        ELSE
            RETURN NEW; -- Skip notification for other statuses
        END IF;
        
    ELSIF TG_TABLE_NAME = 'job_boosts' THEN
        user_uuid := NEW.user_id;
        amount_value := NEW.amount_paid;
        points_value := 0;
        transaction_type := 'boost';
        
        IF NEW.status IN ('completed','paid','active') THEN
            notification_title := 'Job Boost Activated!';
            notification_message := 'Your job boost of ₹' || NEW.amount_paid || ' is now active.';
        ELSIF NEW.status = 'failed' THEN
            notification_title := 'Job Boost Failed';
            notification_message := 'Your job boost payment of ₹' || NEW.amount_paid || ' could not be processed.';
        ELSIF NEW.status = 'pending' THEN
            notification_title := 'Job Boost Processing';
            notification_message := 'Your job boost payment of ₹' || NEW.amount_paid || ' is being processed.';
        ELSE
            RETURN NEW; -- Skip notification for other statuses
        END IF;
        
    ELSIF TG_TABLE_NAME = 'verification_purchases' THEN
        user_uuid := NEW.user_id;
        amount_value := NEW.amount_paid;
        points_value := 0;
        transaction_type := 'verification';
        
        IF NEW.status IN ('completed','paid','active') THEN
            notification_title := 'Verification Badge Activated!';
            notification_message := 'Your verification badge of ₹' || NEW.amount_paid || ' is now active.';
        ELSIF NEW.status = 'failed' THEN
            notification_title := 'Verification Payment Failed';
            notification_message := 'Your verification payment of ₹' || NEW.amount_paid || ' could not be processed.';
        ELSIF NEW.status = 'pending' THEN
            notification_title := 'Verification Processing';
            notification_message := 'Your verification payment of ₹' || NEW.amount_paid || ' is being processed.';
        ELSE
            RETURN NEW; -- Skip notification for other statuses
        END IF;
    ELSE
        RETURN NEW; -- Unknown table
    END IF;

    -- Only send notification if status has changed or it's a new record
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        -- Send notification via edge function (async call) using correct net.http_post
        PERFORM net.http_post(
            url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', current_setting('app.settings.api_external_url', true)
            ),
            body := jsonb_build_object(
                'action', 'send_push',
                'user_id', user_uuid,
                'title', notification_title,
                'message', notification_message,
                'action_url', '/wallet-history'
            )
        );
        
        RAISE NOTICE 'Comprehensive wallet notification sent for user % - %', user_uuid, notification_title;
    END IF;
    
    RETURN NEW;
END;
$$;