-- Create whatsapp_message_reactions table for storing emoji reactions
CREATE TABLE public.whatsapp_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_phone TEXT, -- For external WhatsApp users
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: one user can have one reaction per emoji per message
  UNIQUE(message_id, user_id, emoji)
);

-- Index for faster lookups
CREATE INDEX idx_whatsapp_reactions_message_id ON public.whatsapp_message_reactions(message_id);

-- Enable RLS
ALTER TABLE public.whatsapp_message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admins
CREATE POLICY "Admins can view reactions" 
ON public.whatsapp_message_reactions 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admins can insert reactions" 
ON public.whatsapp_message_reactions 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admins can delete reactions" 
ON public.whatsapp_message_reactions 
FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- Add reply_to_message_id column to whatsapp_messages for proper reply threading
ALTER TABLE public.whatsapp_messages 
ADD COLUMN reply_to_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL;

-- Index for reply lookups
CREATE INDEX idx_whatsapp_messages_reply_to ON public.whatsapp_messages(reply_to_message_id);