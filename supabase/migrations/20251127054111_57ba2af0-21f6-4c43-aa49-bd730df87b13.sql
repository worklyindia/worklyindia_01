-- Add unique constraint on message_hash to enable proper upsert operations
ALTER TABLE ai_response_cache 
ADD CONSTRAINT ai_response_cache_message_hash_key UNIQUE (message_hash);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_keywords 
ON ai_response_cache USING gin(similarity_keywords);

-- Add index for last_accessed_at for cache cleanup
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_last_accessed 
ON ai_response_cache(last_accessed_at);