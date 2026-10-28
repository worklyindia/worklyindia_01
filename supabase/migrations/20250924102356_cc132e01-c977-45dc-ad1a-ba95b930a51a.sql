-- Create function to calculate and update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    calculated_balance INTEGER;
BEGIN
    -- Calculate total balance from all sources
    SELECT COALESCE(
        -- Points from successful transactions
        (SELECT SUM(points) FROM transactions WHERE user_id = target_user_id AND status = 'success'),
        0
    ) + COALESCE(
        -- Points from adjustments (add/deduct)
        (SELECT SUM(CASE WHEN adjustment_type = 'add' THEN points ELSE -points END) 
         FROM point_adjustments WHERE user_id = target_user_id),
        0
    ) - COALESCE(
        -- Points spent on job payments
        (SELECT SUM(points_spent) FROM job_payments WHERE user_id = target_user_id),
        0
    ) - COALESCE(
        -- Points spent from points_transactions with negative amounts
        (SELECT SUM(ABS(points_amount)) FROM points_transactions 
         WHERE user_id = target_user_id AND points_amount < 0),
        0
    ) INTO calculated_balance;
    
    -- Ensure calculated balance is not negative
    IF calculated_balance < 0 THEN
        calculated_balance := 0;
    END IF;
    
    -- Update or insert wallet record
    INSERT INTO wallets (user_id, balance_points, updated_at)
    VALUES (target_user_id, calculated_balance, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        balance_points = calculated_balance,
        updated_at = NOW();
    
    RETURN calculated_balance;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update wallet balance

-- Trigger for transactions
CREATE OR REPLACE FUNCTION trigger_update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM update_wallet_balance(OLD.user_id);
        RETURN OLD;
    ELSE
        PERFORM update_wallet_balance(NEW.user_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for transactions table
DROP TRIGGER IF EXISTS transaction_wallet_update ON transactions;
CREATE TRIGGER transaction_wallet_update
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION trigger_update_wallet_balance();

-- Add triggers for point_adjustments table
DROP TRIGGER IF EXISTS point_adjustment_wallet_update ON point_adjustments;
CREATE TRIGGER point_adjustment_wallet_update
    AFTER INSERT OR UPDATE OR DELETE ON point_adjustments
    FOR EACH ROW EXECUTE FUNCTION trigger_update_wallet_balance();

-- Add triggers for job_payments table
DROP TRIGGER IF EXISTS job_payment_wallet_update ON job_payments;
CREATE TRIGGER job_payment_wallet_update
    AFTER INSERT OR UPDATE OR DELETE ON job_payments
    FOR EACH ROW EXECUTE FUNCTION trigger_update_wallet_balance();

-- Add triggers for points_transactions table
DROP TRIGGER IF EXISTS points_transaction_wallet_update ON points_transactions;
CREATE TRIGGER points_transaction_wallet_update
    AFTER INSERT OR UPDATE OR DELETE ON points_transactions
    FOR EACH ROW EXECUTE FUNCTION trigger_update_wallet_balance();

-- Update all existing wallet balances
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT user_id FROM (
            SELECT user_id FROM transactions
            UNION
            SELECT user_id FROM point_adjustments
            UNION
            SELECT user_id FROM job_payments
            UNION
            SELECT user_id FROM points_transactions
        ) combined_users
    LOOP
        PERFORM update_wallet_balance(user_record.user_id);
    END LOOP;
END
$$;