-- Scheduled emails sent from the user's OWN connected mailbox (Gmail / domain)
ALTER TABLE public.user_scheduled_notifications
  ADD COLUMN IF NOT EXISTS mailbox_provider text,
  ADD COLUMN IF NOT EXISTS mailbox_to text[],
  ADD COLUMN IF NOT EXISTS mailbox_cc text[],
  ADD COLUMN IF NOT EXISTS mailbox_bcc text[],
  ADD COLUMN IF NOT EXISTS mailbox_subject text,
  ADD COLUMN IF NOT EXISTS mailbox_html text,
  ADD COLUMN IF NOT EXISTS mailbox_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_scheduled_notifications_due
  ON public.user_scheduled_notifications (status, scheduled_for);