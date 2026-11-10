-- Enhanced triggers for comprehensive wallet transaction notifications

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS send_payment_notification_trigger ON public.transactions;
DROP TRIGGER IF EXISTS send_boost_notification_trigger ON public.job_boosts;
DROP TRIGGER IF EXISTS send_verification_notification_trigger ON public.verification_purchases;

-- Function to send wallet notifications for all status changes
CREATE OR REPLACE FUNCTION public.send_wallet_transaction_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        
        IF NEW.status = 'completed' OR NEW.status = 'paid' THEN
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
        
        IF NEW.status = 'completed' OR NEW.status = 'paid' OR NEW.status = 'active' THEN
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
        -- Send notification via edge function (async call)
        PERFORM net.http_post(
            url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-wallet-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', current_setting('app.settings.api_external_url', true)
            ),
            body := jsonb_build_object(
                'user_id', user_uuid,
                'title', notification_title,
                'message', notification_message,
                'status', NEW.status,
                'transaction_type', transaction_type,
                'amount', amount_value,
                'points', points_value,
                'action_url', '/wallet-history'
            )
        );
        
        RAISE NOTICE 'Wallet notification sent for user % - %', user_uuid, notification_title;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create triggers for wallet transaction notifications
CREATE TRIGGER send_wallet_notification_transactions
    AFTER INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.send_wallet_transaction_notification();

CREATE TRIGGER send_wallet_notification_boosts  
    AFTER INSERT OR UPDATE ON public.job_boosts
    FOR EACH ROW
    EXECUTE FUNCTION public.send_wallet_transaction_notification();

CREATE TRIGGER send_wallet_notification_verification
    AFTER INSERT OR UPDATE ON public.verification_purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.send_wallet_transaction_notification();

-- Update job posting notification function for points deduction
CREATE OR REPLACE FUNCTION public.send_job_posting_notification() 
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Send notification for job posting payment
    PERFORM net.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-wallet-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', current_setting('app.settings.api_external_url', true)
        ),
        body := jsonb_build_object(
            'user_id', NEW.user_id,
            'title', 'Points Deducted',
            'message', NEW.points_spent || ' points deducted for ' || NEW.description,
            'status', 'success',
            'transaction_type', 'job_posting',
            'points', NEW.points_spent,
            'action_url', '/wallet-history'
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Create trigger for job posting payments
DROP TRIGGER IF EXISTS send_job_posting_notification_trigger ON public.job_payments;
CREATE TRIGGER send_job_posting_notification_trigger
    AFTER INSERT ON public.job_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.send_job_posting_notification();