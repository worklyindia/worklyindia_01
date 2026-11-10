ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_reactions;
UPDATE public.whatsapp_messages m SET reply_to_message_id = p.id
FROM public.whatsapp_messages p
WHERE m.reply_to_message_id IS NULL
  AND m.metadata->'raw'->'context'->>'id' IS NOT NULL
  AND p.msg91_message_id = m.metadata->'raw'->'context'->>'id';