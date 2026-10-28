-- Create app_reviews table for application ratings
CREATE TABLE public.app_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  categories TEXT[],
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_app_reviews_user_id ON public.app_reviews(user_id);
CREATE INDEX idx_app_reviews_created_at ON public.app_reviews(created_at DESC);
CREATE INDEX idx_app_reviews_rating ON public.app_reviews(rating);

-- Enable Row Level Security
ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read reviews
CREATE POLICY "Anyone can read app reviews"
  ON public.app_reviews FOR SELECT
  USING (true);

-- Users can insert their own review (only if they don't have one already)
CREATE POLICY "Users can insert their own review"
  ON public.app_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own review
CREATE POLICY "Users can update their own review"
  ON public.app_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own review
CREATE POLICY "Users can delete their own review"
  ON public.app_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER TABLE public.app_reviews REPLICA IDENTITY FULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_reviews_updated_at
  BEFORE UPDATE ON public.app_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_app_reviews_updated_at();