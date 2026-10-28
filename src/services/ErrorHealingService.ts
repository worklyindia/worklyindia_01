import { CANONICAL_DOMAIN } from '@/config/domainConfig';
interface HealingStrategy {
  name: string;
  condition: (error: Error) => boolean;
  heal: () => Promise<boolean>;
  priority: number;
}

export class ErrorHealingService {
  private static instance: ErrorHealingService;
  private healingStrategies: HealingStrategy[] = [];
  private isHealing = false;
  private healingHistory: Array<{ error: string; strategy: string; success: boolean; timestamp: number }> = [];

  static getInstance(): ErrorHealingService {
    if (!ErrorHealingService.instance) {
      ErrorHealingService.instance = new ErrorHealingService();
    }
    return ErrorHealingService.instance;
  }

  constructor() {
    this.initializeHealingStrategies();
    this.startBackgroundHealing();
  }

  private initializeHealingStrategies() {
    this.healingStrategies = [
      {
        name: 'ChunkLoadError',
        condition: (error) => error.message.toLowerCase().includes('loading chunk'),
        heal: async () => {
          console.log('🔧 Healing chunk load error...');
          
          // CRITICAL: Don't reload during payment
          try {
            if (sessionStorage.getItem('payment_in_progress') === 'true') {
              console.log('🔒 ErrorHealingService: Payment in progress, skipping reload');
              return false;
            }
          } catch {}
          
          // Clear dynamic imports cache
          if ('caches' in window) {
            await caches.delete('dynamic-imports');
          }
          // Force reload modules
          window.location.reload();
          return true;
        },
        priority: 1
      },
      {
        name: 'NetworkError',
        condition: (error) => {
          const msg = error.message.toLowerCase();
          return msg.includes('fetch') || msg.includes('network') || msg.includes('timeout');
        },
        heal: async () => {
          console.log('🔧 Healing network error...');
          // Wait for network recovery
          if (!navigator.onLine) {
            await this.waitForOnline();
          }
          // Clear network cache
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => 
              name.includes('api') ? caches.delete(name) : Promise.resolve()
            ));
          }
          return true;
        },
        priority: 2
      },
      {
        name: 'HydrationError',
        condition: (error) => {
          const msg = error.message.toLowerCase();
          const stack = error.stack?.toLowerCase() || '';
          return msg.includes('hydration') || stack.includes('hydration');
        },
        heal: async () => {
          console.log('🔧 Healing hydration error...');
          // Force re-render after hydration mismatch
          await new Promise(resolve => setTimeout(resolve, 100));
          return true;
        },
        priority: 3
      },
      {
        name: 'MemoryLeak',
        condition: (error) => {
          const msg = error.message.toLowerCase();
          return msg.includes('memory') || msg.includes('heap');
        },
        heal: async () => {
          console.log('🔧 Healing memory issue...');
          // Force garbage collection if available
          if (window.gc) {
            window.gc();
          }
          // Clear unused caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            const oldCaches = cacheNames.filter(name => 
              name.includes('old') || name.includes('temp')
            );
            await Promise.all(oldCaches.map(name => caches.delete(name)));
          }
          return true;
        },
        priority: 4
      },
      {
        name: 'RouteError',
        condition: (error) => {
          const msg = error.message.toLowerCase();
          return msg.includes('route') || msg.includes('navigation');
        },
        heal: async () => {
          console.log('🔧 Healing route error...');
          // Clear route cache and restore from preserved route
          try {
            const preservedRoute = sessionStorage.getItem('errorContext');
            if (preservedRoute) {
              const context = JSON.parse(preservedRoute);
              if (context.route && context.route !== window.location.pathname) {
                window.history.replaceState({}, '', context.route);
              }
            }
          } catch (e) {
            console.warn('Could not restore route:', e);
          }
          return true;
        },
        priority: 5
      }
    ];

    // Sort by priority
    this.healingStrategies.sort((a, b) => a.priority - b.priority);
  }

  private startBackgroundHealing() {
    // Monitor for common issues and heal proactively - 2 minutes (was 30s)
    setInterval(() => {
      this.checkAndHealCommonIssues();
    }, 120000); // 2 minutes instead of 30 seconds - reduced for egress optimization

    // Monitor performance
    if ('performance' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 2000) { // Very slow operations
            this.healPerformanceIssue(entry);
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (e) {
        console.warn('Performance observer not supported:', e);
      }
    }
  }

  private async checkAndHealCommonIssues() {
    try {
      // Check memory usage
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
        
        if (usedMB / limitMB > 0.85) {
          console.log('🔧 Proactive memory cleanup...');
          await this.healingStrategies.find(s => s.name === 'MemoryLeak')?.heal();
        }
      }

      // Check for stale caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const staleCaches = cacheNames.filter(name => {
          // Check if cache is older than 1 hour
          const timestamp = name.match(/\d{13}/)?.[0];
          return timestamp && (Date.now() - parseInt(timestamp)) > 3600000;
        });
        
        if (staleCaches.length > 0) {
          console.log('🔧 Cleaning stale caches...');
          await Promise.all(staleCaches.map(name => caches.delete(name)));
        }
      }

    } catch (e) {
      console.warn('Background healing check failed:', e);
    }
  }

  private async healPerformanceIssue(entry: PerformanceEntry) {
    console.log('🔧 Healing performance issue:', entry.name, entry.duration);
    
    // If it's a slow navigation, preload the next likely pages
    if (entry.entryType === 'navigation') {
      this.preloadLikelyPages();
    }
    
    // If it's a slow resource, try to optimize loading
    if (entry.entryType === 'resource') {
      this.optimizeResourceLoading();
    }
  }

  private preloadLikelyPages() {
    const commonPages = ['/jobs', '/profile', '/notifications'];
    commonPages.forEach(page => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = page;
      document.head.appendChild(link);
    });
  }

  private optimizeResourceLoading() {
    // Add resource hints for better loading
    const hint = document.createElement('link');
    hint.rel = 'dns-prefetch';
    hint.href = `//${CANONICAL_DOMAIN}`;
    document.head.appendChild(hint);
  }

  private waitForOnline(): Promise<void> {
    return new Promise((resolve) => {
      if (navigator.onLine) {
        resolve();
        return;
      }
      
      const handleOnline = () => {
        window.removeEventListener('online', handleOnline);
        resolve();
      };
      
      window.addEventListener('online', handleOnline);
    });
  }

  async healError(error: Error): Promise<boolean> {
    if (this.isHealing) {
      console.log('⏳ Already healing, skipping...');
      return false;
    }

    this.isHealing = true;
    console.log('🔧 Starting error healing for:', error.message);

    try {
      // Find appropriate healing strategy
      const strategy = this.healingStrategies.find(s => s.condition(error));
      
      if (!strategy) {
        console.log('❌ No healing strategy found for error');
        return false;
      }

      console.log(`🔧 Applying healing strategy: ${strategy.name}`);
      const success = await strategy.heal();
      
      // Record healing attempt
      this.healingHistory.push({
        error: error.message,
        strategy: strategy.name,
        success,
        timestamp: Date.now()
      });

      // Keep only last 10 healing attempts
      if (this.healingHistory.length > 10) {
        this.healingHistory = this.healingHistory.slice(-10);
      }

      if (success) {
        console.log('✅ Error healing successful');
      } else {
        console.log('❌ Error healing failed');
      }

      return success;

    } catch (healingError) {
      console.error('❌ Error during healing:', healingError);
      return false;
    } finally {
      this.isHealing = false;
    }
  }

  getHealingHistory() {
    return [...this.healingHistory];
  }

  clearHealingHistory() {
    this.healingHistory = [];
  }
}

export default ErrorHealingService;
