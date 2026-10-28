-- Remove all secrets to allow project remix
DELETE FROM secrets_management WHERE secret_key IN ('OPENAI_API_KEY_11', 'OPENAI_API_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET');