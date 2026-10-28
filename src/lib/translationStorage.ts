interface CachedTranslation {
  cacheKey: string;
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  timestamp: string;
}

const STORAGE_KEY = 'wfh-translation-cache';
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_DAYS = 30;

export const translationStorage = {
  generateCacheKey(content: string, sourceLang: string, targetLang: string): string {
    // Simple hash: first 50 chars + length + languages
    const contentHash = content.slice(0, 50) + content.length;
    return `${contentHash}_${sourceLang}_${targetLang}`;
  },

  getTranslation(content: string, sourceLang: string, targetLang: string): CachedTranslation | null {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return null;

      const cache: CachedTranslation[] = JSON.parse(cached);
      const cacheKey = this.generateCacheKey(content, sourceLang, targetLang);
      
      const found = cache.find(item => 
        item.cacheKey === cacheKey && 
        item.original === content
      );

      if (!found) return null;

      // Check if expired
      const age = Date.now() - new Date(found.timestamp).getTime();
      const maxAge = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
      
      if (age > maxAge) {
        console.log('[TranslationCache] Entry expired, removing...');
        return null;
      }

      console.log('[TranslationCache] ⚡ Cache hit!');
      return found;
    } catch (error) {
      console.error('[TranslationCache] Error reading cache:', error);
      return null;
    }
  },

  saveTranslation(translation: CachedTranslation): void {
    try {
      let cache: CachedTranslation[] = [];
      
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        cache = JSON.parse(existing);
      }

      // Remove duplicates (same cacheKey)
      cache = cache.filter(item => item.cacheKey !== translation.cacheKey);

      // Add new translation
      cache.push(translation);

      // Apply LRU if exceeds max size
      if (cache.length > MAX_CACHE_SIZE) {
        cache.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        cache = cache.slice(-MAX_CACHE_SIZE);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      console.log('[TranslationCache] ✅ Saved to cache. Total entries:', cache.length);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[TranslationCache] Storage quota exceeded, clearing 50%...');
        this.clearOldest(50);
        // Retry save
        try {
          const cache = this.getAllCache();
          cache.push(translation);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        } catch (retryError) {
          console.error('[TranslationCache] Failed to save after clearing:', retryError);
        }
      } else {
        console.error('[TranslationCache] Error saving to cache:', error);
      }
    }
  },

  clearOldest(percentage: number): void {
    try {
      const cache = this.getAllCache();
      const sorted = cache.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const keepCount = Math.ceil(cache.length * (1 - percentage / 100));
      const toKeep = sorted.slice(-keepCount);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toKeep));
      console.log(`[TranslationCache] Cleared ${cache.length - keepCount} old entries`);
    } catch (error) {
      console.error('[TranslationCache] Error clearing old entries:', error);
    }
  },

  clearExpired(): void {
    try {
      const cache = this.getAllCache();
      const maxAge = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      const valid = cache.filter(item => {
        const age = now - new Date(item.timestamp).getTime();
        return age <= maxAge;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      console.log(`[TranslationCache] Cleared ${cache.length - valid.length} expired entries`);
    } catch (error) {
      console.error('[TranslationCache] Error clearing expired:', error);
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[TranslationCache] All cache cleared');
    } catch (error) {
      console.error('[TranslationCache] Error clearing cache:', error);
    }
  },

  getAllCache(): CachedTranslation[] {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('[TranslationCache] Error getting all cache:', error);
      return [];
    }
  },

  getStats(): { count: number; oldestDate: string | null } {
    try {
      const cache = this.getAllCache();
      if (cache.length === 0) {
        return { count: 0, oldestDate: null };
      }

      const sorted = cache.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      return {
        count: cache.length,
        oldestDate: sorted[0].timestamp
      };
    } catch (error) {
      console.error('[TranslationCache] Error getting stats:', error);
      return { count: 0, oldestDate: null };
    }
  }
};
