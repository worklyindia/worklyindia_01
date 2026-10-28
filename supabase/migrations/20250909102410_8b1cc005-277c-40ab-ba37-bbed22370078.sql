-- Insert sample function log entries to demonstrate the system
INSERT INTO function_logs (function_name, execution_id, status, execution_time_ms, error_message, request_data, response_data) VALUES
('test-logging', 'test-exec-001', 'success', 756, NULL, '{"method": "POST", "trigger": "manual"}', '{"success": true, "message": "Test completed"}'),
('analytics-demo', 'analytics-exec-001', 'success', 432, NULL, '{"method": "GET", "trigger": "scheduled"}', '{"analytics": {"totalCalls": 245}, "success": true}'),
('test-logging', 'test-exec-002', 'error', 1200, 'Database connection timeout', '{"method": "POST", "trigger": "manual"}', '{"error": "timeout"}'),
('analytics-demo', 'analytics-exec-002', 'success', 289, NULL, '{"method": "POST", "trigger": "webhook"}', '{"analytics": {"successRate": "94.5%"}, "success": true}'),
('publish-scheduled-jobs', 'pub-jobs-001', 'success', 681, NULL, '{"method": "POST", "trigger": "cron"}', '{"published": 0, "message": "No jobs to publish"}'),
('cleanup-interviews', 'cleanup-001', 'success', 245, NULL, '{"method": "POST", "trigger": "cron"}', '{"deleted": 5, "message": "Cleaned up expired interviews"}'),
('expire-job-boosts', 'boost-expire-001', 'success', 156, NULL, '{"method": "POST", "trigger": "cron"}', '{"expired": 2, "message": "Expired job boosts processed"}'),
('test-logging', 'test-exec-003', 'timeout', 5000, 'Function execution timeout after 5000ms', '{"method": "POST", "trigger": "manual"}', NULL);

-- Update the edge_functions table to include our new functions (using 'active' status)
INSERT INTO edge_functions (name, description, status, created_at, updated_at) VALUES
('test-logging', 'Test function with comprehensive logging middleware', 'active', NOW(), NOW()),
('analytics-demo', 'Demo function showcasing analytics and logging capabilities', 'active', NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = NOW();