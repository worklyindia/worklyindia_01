-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Also touch the table to force cache invalidation
COMMENT ON COLUMN job_applications.employer_id IS 'The employer/company user_id who posted the job';