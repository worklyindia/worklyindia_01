import { supabase } from '@/integrations/supabase/client';

export interface AIChatLogMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export async function persistAIChatMessages(
  userId: string,
  audience: 'default' | 'developer' | 'employer',
  messages: AIChatLogMessage[],
): Promise<void> {
  const rows = messages
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && message.content.trim())
    .map((message) => ({
      user_id: userId,
      audience,
      message_id: message.id,
      role: message.role,
      content: message.content.slice(0, 20000),
      status: 'completed',
      metadata: { source: 'chatwork_app' },
      ...(message.timestamp && !Number.isNaN(Date.parse(message.timestamp))
        ? { created_at: new Date(message.timestamp).toISOString() }
        : {}),
    }));

  if (!rows.length) return;
  const { error } = await supabase
    .from('ai_chat_conversation_logs')
    .upsert(rows, { onConflict: 'user_id,audience,message_id', ignoreDuplicates: true });
  if (error) throw error;
}
