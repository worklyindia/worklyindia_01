-- Enable REPLICA IDENTITY for complete row data in realtime
ALTER TABLE whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE whatsapp_conversations REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;