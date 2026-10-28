-- Fix Free Plan Features
UPDATE ai_chat_plans 
SET features = '["Basic AI Model", "500 Messages/month", "10 Voice Playback/month", "5 AI Images/month", "Community Support"]'::jsonb
WHERE name = 'Free';

-- Fix Basic Plan Features
UPDATE ai_chat_plans 
SET features = '["Standard AI Models", "200 Messages/month", "50 Voice Playback/month", "50 Voice Input/month", "20 Image Analysis/month", "100 AI Images/month", "Fast Response"]'::jsonb
WHERE name = 'Basic';

-- Fix Pro Plan Features
UPDATE ai_chat_plans 
SET features = '["Premium AI Models", "1000 Messages/month", "200 Voice Playback/month", "200 Voice Input/month", "100 Image Analysis/month", "100 AI Images/month", "Priority Response", "Email Support"]'::jsonb
WHERE name = 'Pro';

-- Fix Enterprise Plan Features
UPDATE ai_chat_plans 
SET features = '["All AI Models", "Unlimited Messages", "Unlimited Voice Playback", "Unlimited Voice Input", "Unlimited Image Analysis", "Unlimited AI Images", "Highest Priority", "Priority Support", "Custom Features"]'::jsonb
WHERE name = 'Enterprise';