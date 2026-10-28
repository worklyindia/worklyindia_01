-- First, remove any duplicate records if they exist
DELETE FROM whatsapp_otp_verifications a
USING whatsapp_otp_verifications b
WHERE a.id > b.id 
  AND a.phone = b.phone 
  AND a.purpose = b.purpose;

-- Drop the existing non-unique index
DROP INDEX IF EXISTS idx_whatsapp_otp_phone_purpose;

-- Create a unique constraint (which also creates a unique index)
ALTER TABLE whatsapp_otp_verifications 
ADD CONSTRAINT whatsapp_otp_phone_purpose_unique 
UNIQUE (phone, purpose);