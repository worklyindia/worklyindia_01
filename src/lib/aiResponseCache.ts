interface CachedResponse {
  messageHash: string;
  originalMessage: string;
  response: string;
  timestamp: number;
}

const BASE_CACHE_KEY = 'wfh-ai-response-cache-v2';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHED_RESPONSES = 100;

let cacheUserId: string | null = null;

function getCacheKey(): string {
  if (cacheUserId) {
    return `${BASE_CACHE_KEY}-${cacheUserId}`;
  }
  return BASE_CACHE_KEY;
}

export const aiResponseCache = {
  setCurrentUserId(userId: string | null): void {
    cacheUserId = userId;
  },

  normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  },

  async hashMessage(message: string): Promise<string> {
    const normalized = this.normalizeMessage(message);
    const msgBuffer = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  getAllCached(): CachedResponse[] {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (!cached) return [];
      
      const parsed = JSON.parse(cached) as CachedResponse[];
      const now = Date.now();
      
      const valid = parsed.filter(entry => 
        now - entry.timestamp < CACHE_DURATION
      );
      
      if (valid.length !== parsed.length) {
        localStorage.setItem(getCacheKey(), JSON.stringify(valid));
      }
      
      return valid;
    } catch (error) {
      console.error('Error reading cache:', error);
      return [];
    }
  },

  /**
   * Replies that embed live third-party content (YouTube videos) must never be
   * cached: a video can be deleted or made private later, and replaying the old
   * answer would show an unavailable video.
   */
  isCacheable(response: string): boolean {
    if (!response) return false;
    return !/(youtube\.com|youtu\.be)/i.test(response);
  },

  /**
   * Check local cache — EXACT hash match only (no similarity matching)
   */
  async getFromLocalCache(message: string): Promise<string | null> {
    try {
      const hash = await this.hashMessage(message);
      const cached = this.getAllCached();
      
      const match = cached.find(entry => entry.messageHash === hash);
      
      if (match) {
        if (!this.isCacheable(match.response)) {
          console.log('♻️ Skipping cached reply with live video content');
          return null;
        }
        console.log('⚡ Local cache HIT (exact match):', message.substring(0, 50));
        return match.response;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking local cache:', error);
      return null;
    }
  },

  async saveToLocalCache(message: string, response: string): Promise<void> {
    if (!this.isCacheable(response)) {
      console.log('🚫 Not caching reply with live video content');
      return;
    }

    try {
      const hash = await this.hashMessage(message);
      const cached = this.getAllCached();
      
      const existingIndex = cached.findIndex(
        entry => entry.messageHash === hash
      );
      
      const newEntry: CachedResponse = {
        messageHash: hash,
        originalMessage: message,
        response,
        timestamp: Date.now()
      };
      
      if (existingIndex >= 0) {
        cached[existingIndex] = newEntry;
      } else {
        cached.unshift(newEntry);
        
        if (cached.length > MAX_CACHED_RESPONSES) {
          cached.splice(MAX_CACHED_RESPONSES);
        }
      }
      
      localStorage.setItem(getCacheKey(), JSON.stringify(cached));
      console.log('💾 Saved to local cache:', message.substring(0, 50));
    } catch (error) {
      console.error('Error saving to local cache:', error);
    }
  },

  clearCache(): void {
    try {
      localStorage.removeItem(getCacheKey());
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  },

  getCacheStats(): { count: number; oldestDate: Date | null; newestDate: Date | null } {
    const cached = this.getAllCached();
    
    if (cached.length === 0) {
      return { count: 0, oldestDate: null, newestDate: null };
    }
    
    const timestamps = cached.map(entry => entry.timestamp);
    
    return {
      count: cached.length,
      oldestDate: new Date(Math.min(...timestamps)),
      newestDate: new Date(Math.max(...timestamps))
    };
  }
};
