-- Create user preferences tracking table
CREATE TABLE IF NOT EXISTS user_preferences_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_interactions JSONB DEFAULT '{}',
  location_interactions JSONB DEFAULT '{}',
  salary_range_interactions JSONB DEFAULT '{}',
  job_type_interactions JSONB DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_preferences_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own preferences"
  ON user_preferences_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert preferences"
  ON user_preferences_tracking FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_preferences_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_job_interactions_user_job ON job_interactions(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_job_interactions_type ON job_interactions(interaction_type, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_active_boosted ON jobs(status, is_boosted, created_at DESC);

-- Function to update user preferences
CREATE OR REPLACE FUNCTION update_user_preferences(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_salary_range TEXT DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_prefs RECORD;
BEGIN
  -- Get current preferences or create new
  SELECT * INTO current_prefs
  FROM user_preferences_tracking
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Insert new preferences
    INSERT INTO user_preferences_tracking (
      user_id,
      category_interactions,
      location_interactions,
      salary_range_interactions,
      job_type_interactions
    ) VALUES (
      p_user_id,
      COALESCE(jsonb_build_object(p_category, 1), '{}'),
      COALESCE(jsonb_build_object(p_location, 1), '{}'),
      COALESCE(jsonb_build_object(p_salary_range, 1), '{}'),
      COALESCE(jsonb_build_object(p_job_type, 1), '{}')
    );
  ELSE
    -- Update existing preferences by incrementing counts
    UPDATE user_preferences_tracking SET
      category_interactions = CASE 
        WHEN p_category IS NOT NULL THEN
          jsonb_set(
            category_interactions,
            ARRAY[p_category],
            to_jsonb(COALESCE((category_interactions->>p_category)::int, 0) + 1)
          )
        ELSE category_interactions
      END,
      location_interactions = CASE 
        WHEN p_location IS NOT NULL THEN
          jsonb_set(
            location_interactions,
            ARRAY[p_location],
            to_jsonb(COALESCE((location_interactions->>p_location)::int, 0) + 1)
          )
        ELSE location_interactions
      END,
      salary_range_interactions = CASE 
        WHEN p_salary_range IS NOT NULL THEN
          jsonb_set(
            salary_range_interactions,
            ARRAY[p_salary_range],
            to_jsonb(COALESCE((salary_range_interactions->>p_salary_range)::int, 0) + 1)
          )
        ELSE salary_range_interactions
      END,
      job_type_interactions = CASE 
        WHEN p_job_type IS NOT NULL THEN
          jsonb_set(
            job_type_interactions,
            ARRAY[p_job_type],
            to_jsonb(COALESCE((job_type_interactions->>p_job_type)::int, 0) + 1)
          )
        ELSE job_type_interactions
      END,
      last_updated = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Enhanced personalized jobs function
CREATE OR REPLACE FUNCTION get_personalized_jobs(
  u_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  job_id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  job_type TEXT,
  experience_level TEXT,
  salary_range TEXT,
  description TEXT,
  category TEXT,
  skills TEXT[],
  is_boosted BOOLEAN,
  boost_level INTEGER,
  created_at TIMESTAMPTZ,
  views_count INTEGER,
  applications_count INTEGER,
  logo_url TEXT,
  score INTEGER,
  is_verified BOOLEAN,
  verified_plan_end TIMESTAMPTZ,
  badge_color TEXT,
  company_instagram_link TEXT,
  company_facebook_link TEXT,
  company_youtube_link TEXT,
  company_linkedin_link TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid UUID;
  user_prefs RECORD;
BEGIN
  uid := COALESCE(u_id, auth.uid());

  -- For non-authenticated users, show general jobs
  IF uid IS NULL THEN
    RETURN QUERY
    SELECT 
      j.id AS job_id,
      j.title,
      COALESCE(c.company_name, '') AS company,
      j.location,
      j.job_type,
      j.experience_level,
      j.salary_range,
      j.description,
      j.category,
      j.skills,
      j.is_boosted,
      COALESCE(j.boost_level, 0) AS boost_level,
      j.created_at,
      COALESCE(j.views_count, 0) AS views_count,
      COALESCE(j.applications_count, 0) AS applications_count,
      c.logo_url,
      (
        (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) +
        (CASE WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 40 ELSE 0 END)
      )::INT AS score,
      COALESCE(c.is_verified, FALSE) AS is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link AS company_instagram_link,
      c.facebook_link AS company_facebook_link,
      c.youtube_link AS company_youtube_link,
      c.linkedin_link AS company_linkedin_link
    FROM public.jobs j
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE 
      j.status = 'active'
      AND j.visibility = 'public'
    ORDER BY j.is_boosted DESC, j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Get user preferences
  SELECT * INTO user_prefs
  FROM user_preferences_tracking
  WHERE user_id = uid;

  -- Return personalized jobs
  RETURN QUERY
  WITH user_profile AS (
    SELECT 
      p.user_id,
      COALESCE(p.skills, '{}'::TEXT[]) AS skills,
      p.preferred_location,
      p.job_type,
      p.industry,
      COALESCE(p.experience_level, 0) AS experience_level
    FROM public.profiles p
    WHERE p.user_id = uid
    LIMIT 1
  ),
  viewed_jobs AS (
    SELECT DISTINCT job_id
    FROM job_interactions
    WHERE user_id = uid
      AND interaction_type IN ('view', 'apply')
  )
  SELECT 
    j.id AS job_id,
    j.title,
    COALESCE(c.company_name, '') AS company,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_range,
    j.description,
    j.category,
    j.skills,
    j.is_boosted,
    COALESCE(j.boost_level, 0) AS boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) AS views_count,
    COALESCE(j.applications_count, 0) AS applications_count,
    c.logo_url,
    (
      -- Base scoring
      (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) +
      (CASE WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 40 ELSE 0 END) +
      
      -- Profile matching
      (CASE WHEN up.preferred_location IS NOT NULL AND j.location = up.preferred_location THEN 30 ELSE 0 END) +
      (CASE WHEN up.job_type IS NOT NULL AND j.job_type = up.job_type THEN 20 ELSE 0 END) +
      (CASE WHEN (COALESCE(j.skills, '{}'::TEXT[]) && up.skills) THEN 50 ELSE 0 END) +
      (CASE WHEN up.industry IS NOT NULL AND j.category = up.industry THEN 15 ELSE 0 END) +
      
      -- Preference-based scoring
      (CASE WHEN user_prefs.category_interactions IS NOT NULL 
            AND (user_prefs.category_interactions->>j.category)::INT > 0 THEN 50 ELSE 0 END) +
      (CASE WHEN user_prefs.location_interactions IS NOT NULL 
            AND (user_prefs.location_interactions->>j.location)::INT > 0 THEN 30 ELSE 0 END) +
      (CASE WHEN user_prefs.job_type_interactions IS NOT NULL 
            AND (user_prefs.job_type_interactions->>j.job_type)::INT > 0 THEN 20 ELSE 0 END)
    )::INT AS score,
    COALESCE(c.is_verified, FALSE) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  LEFT JOIN user_profile up ON TRUE
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND c.user_id != uid  -- Exclude user's own jobs
    AND j.id NOT IN (SELECT job_id FROM viewed_jobs)  -- Exclude viewed/applied jobs
  ORDER BY score DESC, j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;