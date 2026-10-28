ALTER TABLE public.telegram_lifecycle_templates
ADD COLUMN buttons jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.telegram_lifecycle_templates.buttons IS
'Telegram inline keyboard buttons: [{id,text,type,value,row}] where type is url, copy_text, or web_app.';