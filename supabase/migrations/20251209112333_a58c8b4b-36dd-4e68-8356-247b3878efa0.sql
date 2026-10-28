-- Add is_starred column to whatsapp_messages table for starred messages feature
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- Create index for efficient starred messages query
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_is_starred 
ON public.whatsapp_messages(is_starred) 
WHERE is_starred = true;