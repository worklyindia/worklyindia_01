-- Add balance tracking columns to referral_wallet_adjustments table
ALTER TABLE referral_wallet_adjustments
ADD COLUMN IF NOT EXISTS balance_before NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_after NUMERIC(10, 2) DEFAULT 0;