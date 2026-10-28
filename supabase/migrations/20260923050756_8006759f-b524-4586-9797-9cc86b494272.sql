DELETE FROM public.expiry_notification_log a USING public.expiry_notification_log b
WHERE a.ctid < b.ctid AND a.entity_type = b.entity_type AND a.entity_id = b.entity_id AND a.stage = b.stage;

CREATE UNIQUE INDEX IF NOT EXISTS expiry_notification_log_unique_stage
  ON public.expiry_notification_log (entity_type, entity_id, stage);