type ChatScope = { company_id?: string | null; audience?: string | null; whatsapp_phone_number_id?: string | null };
type ChatMessage = ChatScope & { conversation_id?: string | null; recipient_phone?: string | null };
type ChatConversation = ChatScope & { id: string; phone_number: string };

/** Recipient identity never establishes business-account ownership. */
export function messageBelongsToChat(message: ChatMessage, conversation: ChatConversation | null) {
  if (!conversation || !conversation.whatsapp_phone_number_id) return false;
  if ((message.company_id || null) !== (conversation.company_id || null)) return false;
  if (message.whatsapp_phone_number_id !== conversation.whatsapp_phone_number_id) return false;
  if (!conversation.company_id && message.audience !== conversation.audience) return false;
  return message.conversation_id === conversation.id ||
    (!message.conversation_id && message.recipient_phone === conversation.phone_number);
}