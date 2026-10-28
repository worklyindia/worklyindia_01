-- Create app_review_replies table
CREATE TABLE public.app_review_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.app_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_review_helpful table
CREATE TABLE public.app_review_helpful (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.app_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_review_replies_review_id ON public.app_review_replies(review_id);
CREATE INDEX idx_review_replies_user_id ON public.app_review_replies(user_id);
CREATE INDEX idx_review_helpful_review_id ON public.app_review_helpful(review_id);
CREATE INDEX idx_review_helpful_user_id ON public.app_review_helpful(user_id);

-- Enable Row Level Security
ALTER TABLE public.app_review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_helpful ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_review_replies
CREATE POLICY "Anyone can read replies"
  ON public.app_review_replies
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create replies"
  ON public.app_review_replies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies"
  ON public.app_review_replies
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies"
  ON public.app_review_replies
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for app_review_helpful
CREATE POLICY "Anyone can read helpful marks"
  ON public.app_review_helpful
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can mark as helpful"
  ON public.app_review_helpful
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their helpful marks"
  ON public.app_review_helpful
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update helpful_count when helpful marks change
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE app_reviews 
    SET helpful_count = helpful_count + 1 
    WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE app_reviews 
    SET helpful_count = GREATEST(helpful_count - 1, 0)
    WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update helpful_count
CREATE TRIGGER trigger_update_helpful_count
AFTER INSERT OR DELETE ON public.app_review_helpful
FOR EACH ROW
EXECUTE FUNCTION update_review_helpful_count();

-- Function to update updated_at on replies
CREATE OR REPLACE FUNCTION update_reply_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reply updated_at
CREATE TRIGGER trigger_reply_updated_at
BEFORE UPDATE ON public.app_review_replies
FOR EACH ROW
EXECUTE FUNCTION update_reply_updated_at();