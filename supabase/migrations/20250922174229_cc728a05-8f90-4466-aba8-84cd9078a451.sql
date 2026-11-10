-- Fix existing triggers and create comprehensive wallet notifications

-- Drop ALL existing triggers first 
DROP TRIGGER IF EXISTS send_wallet_notification_transactions ON public.transactions;
DROP TRIGGER IF EXISTS send_wallet_notification_boosts ON public.job_boosts;
DROP TRIGGER IF EXISTS send_wallet_notification_verification ON public.verification_purchases;
DROP TRIGGER IF EXISTS send_payment_push_notification_trigger ON public.transactions;
DROP TRIGGER IF EXISTS send_payment_notification_trigger ON public.transactions;
DROP TRIGGER IF EXISTS send_boost_notification_trigger ON public.job_boosts;
DROP TRIGGER IF EXISTS send_verification_notification_trigger ON public.verification_purchases;

-- Function to send wallet notifications for all status changes
CREATE OR REPLACE FUNCTION public.send_comprehensive_wallet_notification()
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
        -- Send notification via existing send-notification function
        PERFORM supabase.http_post(
            url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
            headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNzc2MiwiZXhwIjoyMDcwNDgzNzYyfQ.9K2RdyJNBKsaF8f_nIE4WlDuJP3MmC_XFCM6RhGZDz8"}'::jsonb,
            body := jsonb_build_object(
                'action', 'send_push',
                'user_id', user_uuid,
                'title', notification_title,
                'message', notification_message,
                'action_url', '/wallet-history'
            )
        );
        
        RAISE NOTICE 'Wallet notification sent for user % - %', user_uuid, notification_title;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create new triggers with unique names for wallet transaction notifications
CREATE TRIGGER comprehensive_wallet_transactions_trigger
    AFTER INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.send_comprehensive_wallet_notification();

CREATE TRIGGER comprehensive_wallet_boosts_trigger  
    AFTER INSERT OR UPDATE ON public.job_boosts
    FOR EACH ROW
    EXECUTE FUNCTION public.send_comprehensive_wallet_notification();

CREATE TRIGGER comprehensive_wallet_verification_trigger
    AFTER INSERT OR UPDATE ON public.verification_purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.send_comprehensive_wallet_notification();

-- Update job posting notification function for points deduction
CREATE OR REPLACE FUNCTION public.send_job_posting_wallet_notification() 
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Send notification for job posting payment
    PERFORM supabase.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
        headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNzc2MiwiZXhwIjoyMDcwNDgzNzYyfQ.9K2RdyJNBKsaF8f_nIE4WlDuJP3MmC_XFCM6RhGZDz8"}'::jsonb,
        body := jsonb_build_object(
            'action', 'send_push',
            'user_id', NEW.user_id,
            'title', '💼 Points Deducted',
            'message', NEW.points_spent || ' points deducted for ' || NEW.description,
            'action_url', '/wallet-history'
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Create trigger for job posting payments
DROP TRIGGER IF EXISTS send_job_posting_notification_trigger ON public.job_payments;
CREATE TRIGGER job_posting_wallet_notification_trigger
    AFTER INSERT ON public.job_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.send_job_posting_wallet_notification();