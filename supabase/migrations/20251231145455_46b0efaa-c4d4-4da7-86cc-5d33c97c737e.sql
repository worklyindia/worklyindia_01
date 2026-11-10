-- Add missing Payment Successful template for OneSignal
INSERT INTO onesignal_automation_rules (name, trigger_event, target_user_type, title_template, message_template, is_active)
VALUES 
  ('Payment Successful', 'push_payment_successful', 'website_user', 
   'Payment Confirmed ✅', 
   'Your payment of ₹{{amount}} was successful. Thank you for your purchase!', 
   true);