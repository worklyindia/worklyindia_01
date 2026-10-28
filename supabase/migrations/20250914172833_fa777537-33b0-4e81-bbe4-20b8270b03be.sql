-- Create user notification tokens table for OneSignal integration
CREATE TABLE public.user_notification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'web',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, player_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for user access control
CREATE POLICY "Users can view their own notification tokens" 
ON public.user_notification_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification tokens" 
ON public.user_notification_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification tokens" 
ON public.user_notification_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification tokens" 
ON public.user_notification_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_notification_tokens_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_notification_tokens_updated_at
BEFORE UPDATE ON public.user_notification_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_notification_tokens_updated_at_column();