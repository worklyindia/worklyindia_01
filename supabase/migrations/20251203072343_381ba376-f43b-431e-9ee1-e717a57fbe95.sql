-- Create whatsapp_conversations table
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  contact_type TEXT DEFAULT 'unknown',
  linked_user_id UUID,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  session_expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on phone_number
CREATE UNIQUE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);

-- Add new columns to whatsapp_messages table
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outgoing',
ADD COLUMN IF NOT EXISTS message_content TEXT,
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'template';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON public.whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message ON public.whatsapp_conversations(last_message_at DESC);

-- Enable RLS on whatsapp_conversations
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_conversations - admin only
CREATE POLICY "Admins can view all conversations" 
ON public.whatsapp_conversations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM admin_users 
  WHERE admin_users.user_id = auth.uid() 
  AND admin_users.role IN ('admin', 'owner')
));

CREATE POLICY "Admins can insert conversations" 
ON public.whatsapp_conversations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM admin_users 
  WHERE admin_users.user_id = auth.uid() 
  AND admin_users.role IN ('admin', 'owner')
));

CREATE POLICY "Admins can update conversations" 
ON public.whatsapp_conversations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM admin_users 
  WHERE admin_users.user_id = auth.uid() 
  AND admin_users.role IN ('admin', 'owner')
));

CREATE POLICY "Service role can manage conversations" 
ON public.whatsapp_conversations 
FOR ALL 
USING (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_whatsapp_conversation_timestamp();