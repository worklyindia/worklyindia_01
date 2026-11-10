-- Clean up the invalid OneSignal player ID from the database
DELETE FROM user_notification_tokens WHERE player_id = '668fd5dd-51cc-4020-a1ff-6e04749c5c51';

-- Add function to automatically cleanup invalid player IDs when OneSignal reports errors
CREATE OR REPLACE FUNCTION cleanup_invalid_player_ids(invalid_player_ids TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Deactivate all tokens with invalid player IDs
  UPDATE user_notification_tokens 
  SET is_active = false, updated_at = now()
  WHERE player_id = ANY(invalid_player_ids);
  
  -- Log the cleanup for debugging
  RAISE NOTICE 'Deactivated % invalid player IDs', array_length(invalid_player_ids, 1);
END;
$$;