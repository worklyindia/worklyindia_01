-- ============================================================================
-- Phase 1: AI Tricks System - Database Setup (Fixed Order)
-- ============================================================================
-- Creates tables for:
-- 1. AI system users/accounts (FIRST)
-- 2. AI-generated tricks/tips/guides
-- 3. User feedback on tricks
-- ============================================================================

-- ============================================================================
-- Table 1: ai_system_users (CREATE FIRST - no dependencies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_system_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  user_id UUID UNIQUE,
  capabilities JSONB NOT NULL DEFAULT '["create_tricks", "moderate_content", "view_analytics"]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  api_key_hash TEXT,
  last_active_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_ai_system_users_email ON public.ai_system_users(email);
CREATE INDEX idx_ai_system_users_user_id ON public.ai_system_users(user_id);
CREATE INDEX idx_ai_system_users_status ON public.ai_system_users(status);

-- Enable RLS
ALTER TABLE public.ai_system_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view AI system users
CREATE POLICY "Only admins can view AI system users"
ON public.ai_system_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- RLS Policy: Only owners can insert AI system users
CREATE POLICY "Only owners can insert AI system users"
ON public.ai_system_users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  )
);

-- RLS Policy: Only owners can update AI system users
CREATE POLICY "Only owners can update AI system users"
ON public.ai_system_users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  )
);

-- RLS Policy: Only owners can delete AI system users
CREATE POLICY "Only owners can delete AI system users"
ON public.ai_system_users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  )
);

-- ============================================================================
-- Table 2: ai_generated_tricks (CREATE SECOND - depends on ai_system_users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_generated_tricks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('job_search', 'interview', 'resume', 'safety', 'career', 'salary', 'skills', 'networking', 'remote_work', 'freelancing')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('hi', 'en')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'archived')),
  views_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  ai_model TEXT NOT NULL DEFAULT 'gpt-4',
  generated_by UUID REFERENCES public.ai_system_users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_ai_tricks_category ON public.ai_generated_tricks(category);
CREATE INDEX idx_ai_tricks_language ON public.ai_generated_tricks(language);
CREATE INDEX idx_ai_tricks_status ON public.ai_generated_tricks(status);
CREATE INDEX idx_ai_tricks_created_at ON public.ai_generated_tricks(created_at DESC);
CREATE INDEX idx_ai_tricks_views ON public.ai_generated_tricks(views_count DESC);
CREATE INDEX idx_ai_tricks_helpful ON public.ai_generated_tricks(helpful_count DESC);
CREATE INDEX idx_ai_tricks_generated_by ON public.ai_generated_tricks(generated_by);

-- Enable RLS
ALTER TABLE public.ai_generated_tricks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view published tricks
CREATE POLICY "Anyone can view published tricks"
ON public.ai_generated_tricks
FOR SELECT
USING (status = 'published');

-- RLS Policy: Admins can view all tricks
CREATE POLICY "Admins can view all tricks"
ON public.ai_generated_tricks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- RLS Policy: AI system users and admins can insert tricks
CREATE POLICY "AI and admins can insert tricks"
ON public.ai_generated_tricks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner', 'system_admin')
  )
);

-- RLS Policy: AI system users and admins can update tricks
CREATE POLICY "AI and admins can update tricks"
ON public.ai_generated_tricks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner', 'system_admin')
  )
);

-- RLS Policy: Admins can delete tricks
CREATE POLICY "Admins can delete tricks"
ON public.ai_generated_tricks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- ============================================================================
-- Table 3: trick_feedback (CREATE THIRD - depends on ai_generated_tricks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trick_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trick_id UUID NOT NULL REFERENCES public.ai_generated_tricks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(trick_id, user_id)
);

-- Add indexes
CREATE INDEX idx_trick_feedback_trick_id ON public.trick_feedback(trick_id);
CREATE INDEX idx_trick_feedback_user_id ON public.trick_feedback(user_id);
CREATE INDEX idx_trick_feedback_is_helpful ON public.trick_feedback(is_helpful);

-- Enable RLS
ALTER TABLE public.trick_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.trick_feedback
FOR SELECT
USING (user_id = auth.uid());

-- RLS Policy: Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
ON public.trick_feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- RLS Policy: Authenticated users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.trick_feedback
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
ON public.trick_feedback
FOR UPDATE
USING (user_id = auth.uid());

-- RLS Policy: Users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
ON public.trick_feedback
FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_ai_tricks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_tricks_timestamp
BEFORE UPDATE ON public.ai_generated_tricks
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_tricks_updated_at();

CREATE TRIGGER update_ai_system_users_timestamp
BEFORE UPDATE ON public.ai_system_users
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_tricks_updated_at();

-- ============================================================================
-- Trigger: Auto-update trick helpful counts on feedback
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_trick_helpful_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_helpful = true THEN
      UPDATE public.ai_generated_tricks 
      SET helpful_count = helpful_count + 1 
      WHERE id = NEW.trick_id;
    ELSE
      UPDATE public.ai_generated_tricks 
      SET not_helpful_count = not_helpful_count + 1 
      WHERE id = NEW.trick_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_helpful != NEW.is_helpful THEN
      IF NEW.is_helpful = true THEN
        UPDATE public.ai_generated_tricks 
        SET helpful_count = helpful_count + 1,
            not_helpful_count = not_helpful_count - 1
        WHERE id = NEW.trick_id;
      ELSE
        UPDATE public.ai_generated_tricks 
        SET helpful_count = helpful_count - 1,
            not_helpful_count = not_helpful_count + 1
        WHERE id = NEW.trick_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_helpful = true THEN
      UPDATE public.ai_generated_tricks 
      SET helpful_count = helpful_count - 1 
      WHERE id = OLD.trick_id;
    ELSE
      UPDATE public.ai_generated_tricks 
      SET not_helpful_count = not_helpful_count - 1 
      WHERE id = OLD.trick_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trick_helpful_counts
AFTER INSERT OR UPDATE OR DELETE ON public.trick_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_trick_helpful_counts();

-- ============================================================================
-- Helper Function: Increment trick views
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_trick_views(trick_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ai_generated_tricks 
  SET views_count = views_count + 1 
  WHERE id = trick_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and anonymous
GRANT EXECUTE ON FUNCTION public.increment_trick_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_trick_views(UUID) TO anon;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.ai_system_users IS 'Stores AI system accounts that can generate content';
COMMENT ON TABLE public.ai_generated_tricks IS 'Stores AI-generated tips, tricks, and guides for users';
COMMENT ON TABLE public.trick_feedback IS 'Stores user feedback on tricks (helpful/not helpful)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 1 Complete: AI Tricks database tables created successfully!';
  RAISE NOTICE '📊 Created tables: ai_system_users → ai_generated_tricks → trick_feedback';
  RAISE NOTICE '🔒 RLS policies enabled for all tables with proper access control';
  RAISE NOTICE '⚡ Triggers created for auto-updates and feedback counting';
  RAISE NOTICE '🎯 Ready for Phase 2: AI system user creation';
END $$;