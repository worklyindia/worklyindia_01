-- MSG91 WhatsApp Complete Setup Tables

-- Campaigns table for managing WhatsApp campaigns
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  target_audience TEXT NOT NULL, -- 'all_job_seekers', 'all_employers', 'custom_segment', etc.
  segment_filter JSONB, -- Filter criteria for custom segments
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'active', 'completed', 'cancelled'
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact segments for organizing WhatsApp contacts
CREATE TABLE IF NOT EXISTS whatsapp_contact_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB NOT NULL, -- Dynamic filter criteria
  contact_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation rules for triggered WhatsApp messages
CREATE TABLE IF NOT EXISTS whatsapp_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL, -- 'user_signup', 'job_posted', 'application_submitted', etc.
  trigger_conditions JSONB, -- Additional conditions
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  variable_mapping JSONB, -- Map event data to template variables
  delay_minutes INTEGER DEFAULT 0, -- Delay before sending
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media library for WhatsApp attachments
CREATE TABLE IF NOT EXISTS whatsapp_media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'document', 'video', 'audio'
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  folder TEXT DEFAULT 'general',
  mime_type TEXT,
  is_approved BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook logs for tracking MSG91 webhook events
CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'sent', 'delivered', 'read', 'failed'
  message_id UUID REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  msg91_message_id TEXT,
  payload JSONB NOT NULL,
  status_code INTEGER,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact preferences for opt-in/opt-out management
CREATE TABLE IF NOT EXISTS whatsapp_contact_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  is_opted_in BOOLEAN DEFAULT true,
  opted_out_at TIMESTAMPTZ,
  is_blacklisted BOOLEAN DEFAULT false,
  blacklisted_reason TEXT,
  blacklisted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

-- Campaign recipients tracking
CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  message_id UUID REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON whatsapp_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON whatsapp_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON whatsapp_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON whatsapp_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON whatsapp_automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON whatsapp_automation_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_message ON whatsapp_webhook_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON whatsapp_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_contact_prefs_user ON whatsapp_contact_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_prefs_phone ON whatsapp_contact_preferences(phone_number);
CREATE INDEX IF NOT EXISTS idx_media_library_folder ON whatsapp_media_library(folder);

-- Enable RLS
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contact_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contact_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin only for now)
CREATE POLICY "Admin full access to campaigns" ON whatsapp_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admin full access to segments" ON whatsapp_contact_segments FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admin full access to automation rules" ON whatsapp_automation_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admin full access to media library" ON whatsapp_media_library FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admin full access to webhook logs" ON whatsapp_webhook_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admin full access to contact preferences" ON whatsapp_contact_preferences FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

CREATE POLICY "Admin full access to campaign recipients" ON whatsapp_campaign_recipients FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON whatsapp_contact_segments
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON whatsapp_automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER update_contact_prefs_updated_at BEFORE UPDATE ON whatsapp_contact_preferences
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();