-- Add name column to referral_payment_settings table
ALTER TABLE referral_payment_settings 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Add comment for the new column
COMMENT ON COLUMN referral_payment_settings.name IS 'Full name of the user for payment purposes';