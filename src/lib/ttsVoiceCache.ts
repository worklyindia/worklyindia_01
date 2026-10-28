// TTS Voice Cache System for AI Career Chat
// Stores base64 audio in localStorage to prevent repeated API calls

interface CachedVoice {
  audioContent: string;  // base64 MP3
  timestamp: number;
  messageHash: string;
}

const CACHE_KEY_PREFIX = 'tts_cache_';
const MAX_CACHE_ENTRIES = 50; // LRU eviction
const CACHE_TTL_DAYS = 7;

// Generate a simple hash from message content
const hashMessage = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

// Get cached audio for a message
export const getCachedAudio = (messageContent: string): string | null => {
  try {
    const messageHash = hashMessage(messageContent);
    const cacheKey = `${CACHE_KEY_PREFIX}${messageHash}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const parsedCache: CachedVoice = JSON.parse(cached);
    const now = Date.now();
    const ttl = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    
    // Check if expired
    if (now - parsedCache.timestamp > ttl) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log('✅ TTS cache hit for message:', messageContent.substring(0, 30) + '...');
    return parsedCache.audioContent;
  } catch (error) {
    console.error('Error reading TTS cache:', error);
    return null;
  }
};

// Save audio to cache
export const setCachedAudio = (messageContent: string, audioContent: string): void => {
  try {
    const messageHash = hashMessage(messageContent);
    const cacheKey = `${CACHE_KEY_PREFIX}${messageHash}`;
    
    const cachedVoice: CachedVoice = {
      audioContent,
      timestamp: Date.now(),
      messageHash
    };
    
    // Check cache size and evict oldest if needed
    const allCacheKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    if (allCacheKeys.length >= MAX_CACHE_ENTRIES) {
      // Find oldest entry
      let oldestKey = allCacheKeys[0];
      let oldestTimestamp = Infinity;
      
      allCacheKeys.forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed: CachedVoice = JSON.parse(item);
            if (parsed.timestamp < oldestTimestamp) {
              oldestTimestamp = parsed.timestamp;
              oldestKey = key;
            }
          }
        } catch (e) {
          // Invalid entry, remove it
          localStorage.removeItem(key);
        }
      });
      
      localStorage.removeItem(oldestKey);
      console.log('🗑️ Evicted oldest TTS cache entry (LRU)');
    }
    
    localStorage.setItem(cacheKey, JSON.stringify(cachedVoice));
    console.log('💾 Cached TTS audio for message:', messageContent.substring(0, 30) + '...');
  } catch (error) {
    console.error('Error saving to TTS cache:', error);
  }
};

// Clear expired cache entries
export const clearExpiredCache = (): void => {
  try {
    const allCacheKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    const now = Date.now();
    const ttl = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    let clearedCount = 0;
    
    allCacheKeys.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed: CachedVoice = JSON.parse(item);
          if (now - parsed.timestamp > ttl) {
            localStorage.removeItem(key);
            clearedCount++;
          }
        }
      } catch (e) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    });
    
    if (clearedCount > 0) {
      console.log(`🧹 Cleared ${clearedCount} expired TTS cache entries`);
    }
  } catch (error) {
    console.error('Error clearing expired cache:', error);
  }
};

// Get cache stats
export const getCacheStats = (): { count: number; size: string } => {
  try {
    const allCacheKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    let totalSize = 0;
    allCacheKeys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length * 2; // Approximate bytes (UTF-16)
      }
    });
    
    return {
      count: allCacheKeys.length,
      size: `${(totalSize / 1024 / 1024).toFixed(2)} MB`
    };
  } catch (error) {
    return { count: 0, size: '0 MB' };
  }
};
