-- ============================================
-- AGGRESSIVE SUPABASE FREE PLAN CLEANUP
-- Removes unused functions and cleans data
-- ============================================

-- 1. Drop unused database functions (SEO, Speed, Interview Mode Analytics)
DROP FUNCTION IF EXISTS get_interview_mode_analytics(text);
DROP FUNCTION IF EXISTS get_live_analytics();
DROP FUNCTION IF EXISTS cleanup_inactive_live_sessions();
DROP FUNCTION IF EXISTS cleanup_inactive_sessions();
DROP FUNCTION IF EXISTS get_interview_mode_stats();
DROP FUNCTION IF EXISTS get_live_session_analytics();
DROP FUNCTION IF EXISTS get_active_sessions_count();

-- 2. TRUNCATE live_sessions table (tracking is disabled)
TRUNCATE TABLE live_sessions;

-- 3. Delete old daily visitors (keep only today)
DELETE FROM daily_unique_visitors 
WHERE visit_date < CURRENT_DATE;

-- 4. Delete old function logs (keep last 24 hours)
DELETE FROM function_logs 
WHERE created_at < NOW() - INTERVAL '24 hours';

-- 5. Delete old cleanup logs (keep last 7 days)
DELETE FROM cleanup_logs 
WHERE executed_at < NOW() - INTERVAL '7 days';

-- 6. Delete old egress optimization logs (keep last 7 days)
DELETE FROM egress_optimization_logs 
WHERE created_at < NOW() - INTERVAL '7 days';

-- 7. Delete old cleanup execution logs (keep last 7 days)
DELETE FROM cleanup_execution_logs 
WHERE executed_at < NOW() - INTERVAL '7 days';

-- 8. Delete old API request logs (keep last 7 days)
DELETE FROM api_request_logs 
WHERE created_at < NOW() - INTERVAL '7 days';

-- 9. Delete old API health checks (keep last 24 hours)
DELETE FROM api_health_checks 
WHERE checked_at < NOW() - INTERVAL '24 hours';

-- 10. Delete archived audit logs older than 30 days
DELETE FROM admin_audit_logs_archive 
WHERE archived_at < NOW() - INTERVAL '30 days';

-- 11. Vacuum tables to reclaim space (run analyze to update statistics)
-- Note: VACUUM FULL requires exclusive lock, so we use regular VACUUM
ANALYZE live_sessions;
ANALYZE daily_unique_visitors;
ANALYZE function_logs;
ANALYZE cleanup_logs;