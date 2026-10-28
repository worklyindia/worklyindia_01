-- Add constraint to allow 'spend' transaction type
ALTER TABLE points_transactions 
DROP CONSTRAINT IF EXISTS points_transactions_transaction_type_check;

-- Recreate constraint with additional transaction types
ALTER TABLE points_transactions 
ADD CONSTRAINT points_transactions_transaction_type_check 
CHECK (transaction_type IN ('purchase', 'spend', 'adjustment', 'deduction', 'refund'));