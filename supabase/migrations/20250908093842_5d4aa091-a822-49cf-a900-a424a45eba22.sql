-- Set expires_at for all existing jobs that don't have it (30 days from created_at)
UPDATE jobs 
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Create function to delete expired jobs and all related data
CREATE OR REPLACE FUNCTION public.delete_expired_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    expired_count INTEGER := 0;
    job_record RECORD;
BEGIN
    -- Get all expired jobs
    FOR job_record IN 
        SELECT id FROM jobs 
        WHERE status = 'active' 
        AND expires_at <= NOW()
    LOOP
        -- Delete related data first (in correct order to avoid FK conflicts)
        DELETE FROM chat_messages WHERE conversation_id IN (
            SELECT id FROM conversations WHERE job_id = job_record.id
        );
        DELETE FROM conversations WHERE job_id = job_record.id;
        DELETE FROM interviews WHERE job_id = job_record.id;
        DELETE FROM job_interactions WHERE job_id = job_record.id;
        DELETE FROM job_comments WHERE job_id = job_record.id;
        DELETE FROM job_favorites WHERE job_id = job_record.id;
        DELETE FROM job_applications WHERE job_id = job_record.id;
        DELETE FROM job_boosts WHERE job_id = job_record.id;
        
        -- Update notifications to mark job as deleted
        UPDATE notifications 
        SET metadata = metadata || '{"job_deleted": true}'::jsonb
        WHERE metadata->>'job_id' = job_record.id::text;
        
        UPDATE employer_notifications 
        SET metadata = metadata || '{"job_deleted": true}'::jsonb
        WHERE metadata->>'job_id' = job_record.id::text;
        
        -- Finally delete the job
        DELETE FROM jobs WHERE id = job_record.id;
        
        expired_count := expired_count + 1;
    END LOOP;
    
    RETURN expired_count;
END;
$function$;

-- Create trigger to auto-set expires_at for new jobs
CREATE OR REPLACE FUNCTION public.set_job_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Set expires_at to 30 days from created_at if not already set
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := NEW.created_at + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger on jobs table
DROP TRIGGER IF EXISTS set_job_expiry_trigger ON jobs;
CREATE TRIGGER set_job_expiry_trigger
    BEFORE INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_job_expiry();

-- Schedule daily cleanup of expired jobs (runs at 2 AM every day)
SELECT cron.schedule(
    'delete-expired-jobs-daily',
    '0 2 * * *',
    $$
    SELECT public.delete_expired_jobs();
    $$
);