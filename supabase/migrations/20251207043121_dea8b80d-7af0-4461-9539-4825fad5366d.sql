-- First, delete duplicate reactions keeping only the latest one per user per message
DELETE FROM whatsapp_message_reactions a
USING whatsapp_message_reactions b
WHERE a.message_id = b.message_id 
  AND a.user_id = b.user_id 
  AND a.created_at < b.created_at;

-- Drop the old unique constraint if exists
ALTER TABLE whatsapp_message_reactions 
DROP CONSTRAINT IF EXISTS whatsapp_message_reactions_message_id_user_id_emoji_key;

-- Create new unique constraint on (message_id, user_id) - only one reaction per user per message
ALTER TABLE whatsapp_message_reactions 
ADD CONSTRAINT whatsapp_message_reactions_message_user_unique 
UNIQUE (message_id, user_id);