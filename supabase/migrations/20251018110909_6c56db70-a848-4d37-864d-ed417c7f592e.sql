-- Re-add secrets metadata for interview and payment functionality
INSERT INTO secrets_management (secret_key, description, used_by_functions) VALUES
('RAZORPAY_KEY_ID', 'Razorpay payment gateway key ID', ARRAY['create-boost-order', 'create-guest-order', 'create-razorpay-order', 'create-verification-order', 'payment-reconciliation', 'razorpay-webhook']),
('RAZORPAY_KEY_SECRET', 'Razorpay payment gateway secret key', ARRAY['create-boost-order', 'create-guest-order', 'create-razorpay-order', 'create-verification-order', 'payment-reconciliation', 'razorpay-webhook']);