-- Create AI Response Cache table for cost optimization
CREATE TABLE IF NOT EXISTS ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_hash TEXT NOT NULL,
  original_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  similarity_keywords TEXT[],
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_message_hash ON ai_response_cache(message_hash);
CREATE INDEX IF NOT EXISTS idx_similarity_keywords ON ai_response_cache USING gin(similarity_keywords);
CREATE INDEX IF NOT EXISTS idx_created_at ON ai_response_cache(created_at);

-- RLS Policies
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage cache
CREATE POLICY "Service role can manage cache"
  ON ai_response_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read cache
CREATE POLICY "Authenticated users can read cache"
  ON ai_response_cache
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE ai_response_cache IS 'Caches AI responses to reduce API costs and improve response times';