-- Fix security warnings: Set search_path for all database functions
-- This prevents search_path hijacking attacks

DO $$ 
DECLARE 
    func_record RECORD;
    func_count INTEGER := 0;
BEGIN
    -- Loop through all user-defined functions in public schema
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'
    LOOP
        BEGIN
            -- Set search_path for each function
            EXECUTE format(
                'ALTER FUNCTION public.%I(%s) SET search_path TO public',
                func_record.function_name,
                func_record.args
            );
            func_count := func_count + 1;
        EXCEPTION 
            WHEN OTHERS THEN
                -- Skip functions that cannot be updated
                CONTINUE;
        END;
    END LOOP;
    
    RAISE NOTICE 'Successfully updated search_path for % functions', func_count;
END $$;

-- Create performance index for interviews cleanup (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'interviews'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_interviews_status_updated_at 
        ON public.interviews(status, updated_at) 
        WHERE status IN ('completed', 'cancelled');
        
        COMMENT ON INDEX idx_interviews_status_updated_at IS 
        'Optimizes cleanup-old-interviews edge function queries';
    END IF;
END $$;
