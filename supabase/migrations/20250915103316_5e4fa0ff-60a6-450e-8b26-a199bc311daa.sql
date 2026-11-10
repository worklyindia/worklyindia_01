-- Fix net.http_post error by removing problematic cron jobs
-- First check what cron jobs exist
SELECT jobname, schedule, command FROM cron.job;