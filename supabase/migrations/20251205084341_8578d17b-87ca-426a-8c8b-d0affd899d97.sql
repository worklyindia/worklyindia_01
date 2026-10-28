-- Fix messages that have read_at but wrong status
UPDATE whatsapp_messages 
SET status = 'read' 
WHERE read_at IS NOT NULL AND status != 'read' AND status != 'failed';

-- Fix messages that have delivered_at but no read_at and wrong status
UPDATE whatsapp_messages 
SET status = 'delivered' 
WHERE delivered_at IS NOT NULL AND read_at IS NULL AND status NOT IN ('delivered', 'read', 'failed');