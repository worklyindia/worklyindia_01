-- Add delivery tracking columns to whatsapp_trigger_logs if not exists
ALTER TABLE public.whatsapp_trigger_logs 
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS read_at timestamptz,
ADD COLUMN IF NOT EXISTS msg91_delivery_response jsonb;

-- Add index for faster delivery status queries
CREATE INDEX IF NOT EXISTS idx_trigger_logs_delivery_status ON public.whatsapp_trigger_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_msg91_request_id ON public.whatsapp_trigger_logs(msg91_request_id);

-- Comment for documentation
COMMENT ON COLUMN public.whatsapp_trigger_logs.delivery_status IS 'WhatsApp delivery status: pending, sent, delivered, read, failed';
COMMENT ON COLUMN public.whatsapp_trigger_logs.delivered_at IS 'Timestamp when WhatsApp confirmed delivery';
COMMENT ON COLUMN public.whatsapp_trigger_logs.read_at IS 'Timestamp when user read the message';
COMMENT ON COLUMN public.whatsapp_trigger_logs.msg91_delivery_response IS 'Raw webhook response from MSG91 delivery report';