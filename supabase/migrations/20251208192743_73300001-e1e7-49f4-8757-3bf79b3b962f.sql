-- Add dynamic wallet balance quick reply triggers
INSERT INTO public.whatsapp_quick_replies (
  trigger_keywords, 
  response_hindi, 
  response_english, 
  category, 
  priority,
  enabled
) VALUES 
(
  ARRAY['point wallet balance', 'point balance', 'points balance', 'my points', 'mera point', 'mera balance', 'wallet balance', 'point wallet', 'mera wallet', 'balance check', 'kitne points', 'kitna point', 'points kitne', 'check balance', 'balance dekho', 'balance batao'],
  'DYNAMIC_POINT_WALLET',
  'DYNAMIC_POINT_WALLET',
  'dynamic_wallet',
  200,
  true
),
(
  ARRAY['refer wallet balance', 'referral balance', 'refer balance', 'mera referral', 'referral earnings', 'refer earnings', 'referral wallet', 'refer wallet', 'referral kitna', 'refer kitna', 'referral amount', 'referral check', 'refer check', 'earning check', 'mera earning'],
  'DYNAMIC_REFER_WALLET',
  'DYNAMIC_REFER_WALLET',
  'dynamic_wallet',
  200,
  true
);