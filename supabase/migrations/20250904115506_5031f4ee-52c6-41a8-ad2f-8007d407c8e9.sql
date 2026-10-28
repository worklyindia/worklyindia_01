-- Create conversations table for employer-applicant chats
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  employer_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(job_id, employer_id, applicant_id)
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('employer', 'applicant')),
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Employers can view their conversations"
ON public.conversations
FOR ALL
USING (employer_id = auth.uid());

CREATE POLICY "Applicants can view their conversations" 
ON public.conversations
FOR ALL
USING (applicant_id = auth.uid());

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = chat_messages.conversation_id
    AND (c.employer_id = auth.uid() OR c.applicant_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages in their conversations"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = chat_messages.conversation_id
    AND (c.employer_id = auth.uid() OR c.applicant_id = auth.uid())
  )
  AND sender_id = auth.uid()
);

-- Create trigger to update conversation's last_message_at
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();

-- Add indexes for performance
CREATE INDEX idx_conversations_employer_id ON public.conversations(employer_id);
CREATE INDEX idx_conversations_applicant_id ON public.conversations(applicant_id);
CREATE INDEX idx_conversations_job_id ON public.conversations(job_id);
CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);