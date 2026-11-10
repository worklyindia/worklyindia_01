export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrls?: string[];
  voiceUrl?: string;
  voiceDuration?: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  starred?: boolean;
  feedback?: 'like' | 'dislike';
}

const BASE_STORAGE_KEY = 'wfh-ai-chat-history';
const MAX_MESSAGES = 50;

let currentUserId: string | null = null;
let currentAudience = 'default';

function getStorageKey(): string {
  if (currentUserId) {
    return currentAudience === 'developer' ? `${BASE_STORAGE_KEY}-${currentUserId}-developer` : `${BASE_STORAGE_KEY}-${currentUserId}`;
  }
  return BASE_STORAGE_KEY;
}

export const chatStorage = {
  setCurrentUserId(userId: string | null): void {
    currentUserId = userId;
  },

  setAudience(audience: string): void {
    currentAudience = audience;
  },

  getCurrentUserId(): string | null {
    return currentUserId;
  },

  loadMessages(): StoredMessage[] {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (!stored) return [];
      const messages = JSON.parse(stored);
      return Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return [];
    }
  },

  saveMessages(messages: StoredMessage[]): void {
    try {
      const toSave = messages.slice(-MAX_MESSAGES);
      localStorage.setItem(getStorageKey(), JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save chat history:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        const reducedMessages = messages.slice(-25);
        localStorage.setItem(getStorageKey(), JSON.stringify(reducedMessages));
      }
    }
  },

  clearMessages(): void {
    try {
      localStorage.removeItem(getStorageKey());
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  },

  deleteMessages(messageIds: string[]): void {
    try {
      const messages = this.loadMessages();
      const filtered = messages.filter(msg => !messageIds.includes(msg.id));
      this.saveMessages(filtered);
    } catch (error) {
      console.error('Failed to delete messages:', error);
    }
  },

  toggleStarMessage(messageId: string): void {
    try {
      const messages = this.loadMessages();
      const updated = messages.map(msg => 
        msg.id === messageId ? { ...msg, starred: !msg.starred } : msg
      );
      this.saveMessages(updated);
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  }
};
