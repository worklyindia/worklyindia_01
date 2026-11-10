interface NetworkConfig {
  staleTime: number;
  gcTime: number;
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  refetchOnFocus: boolean;
  refetchOnMount: boolean | 'always';
  maxConcurrentRequests: number;
  requestTimeout: number;
}

// Get network connection info
const getNetworkInfo = () => {
  const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
  
  return {
    effectiveType: connection?.effectiveType || '4g',
    downlink: connection?.downlink || 10,
    rtt: connection?.rtt || 50,
    saveData: connection?.saveData || false,
  };
};

// Get network type label (5G, 4G, 3G, 2G)
export const getNetworkType = (): string => {
  const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
  
  const { effectiveType, downlink, rtt } = getNetworkInfo();
  
  // Debug: Log actual network values
  console.log('🌐 Network Info:', { effectiveType, downlink, rtt, connectionType: connection?.type });
  
  // Check if connection type explicitly mentions 5G
  if (connection?.type?.includes('5g')) {
    console.log('✅ Detected as 5G (connection.type)');
    return '5G';
  }
  
  // Detect 5G based on network characteristics (more lenient and realistic thresholds)
  // Real-world 5G varies significantly: >5 Mbps with good latency, or >8 Mbps alone
  if ((downlink > 5 && rtt < 100) || downlink > 8) {
    console.log('✅ Detected as 5G (speed metrics)', { downlink, rtt });
    return '5G';
  }
  
  // Use effectiveType from Network Information API
  if (effectiveType === '4g') {
    console.log('📱 Showing 4G (effectiveType)');
    return '4G';
  }
  if (effectiveType === '3g') return '3G';
  if (effectiveType === '2g' || effectiveType === 'slow-2g') return '2G';
  
  // Default to 4G if unknown
  return '4G';
};

// Determine network speed category
export const getNetworkSpeed = (): 'slow' | 'medium' | 'fast' => {
  const { effectiveType, downlink, rtt, saveData } = getNetworkInfo();
  
  // User explicitly wants to save data
  if (saveData) return 'slow';
  
  // Very slow networks (2G and slower)
  if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5 || rtt > 500) {
    return 'slow';
  }
  
  // Medium networks (3G)
  if (effectiveType === '3g' || downlink < 2 || rtt > 200) {
    return 'medium';
  }
  
  // Fast networks (4G, 5G, WiFi)
  return 'fast';
};

// Get optimized config based on network speed
export const getNetworkOptimizedConfig = (): NetworkConfig => {
  const speed = getNetworkSpeed();
  
  const configs: Record<'slow' | 'medium' | 'fast', NetworkConfig> = {
    slow: {
      staleTime: 1000 * 60 * 10, // 10 minutes - use cache aggressively
      gcTime: 1000 * 60 * 60, // 60 minutes - keep cache longer
      maxRetries: 1, // Only retry once
      retryDelay: 2000, // Wait longer before retry
      maxRetryDelay: 15000,
      refetchOnFocus: false, // Don't refetch on focus
      refetchOnMount: false, // Use cache on mount
      maxConcurrentRequests: 1, // Only 1 request at a time
      requestTimeout: 15000, // 15 second timeout
    },
    medium: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      maxRetries: 2,
      retryDelay: 1000,
      maxRetryDelay: 10000,
      refetchOnFocus: false,
      refetchOnMount: 'always',
      maxConcurrentRequests: 2, // 2 concurrent requests
      requestTimeout: 10000, // 10 second timeout
    },
    fast: {
      staleTime: 1000 * 60 * 2, // 2 minutes - fresher data
      gcTime: 1000 * 60 * 15, // 15 minutes
      maxRetries: 3,
      retryDelay: 500,
      maxRetryDelay: 5000,
      refetchOnFocus: false,
      refetchOnMount: 'always',
      maxConcurrentRequests: 6, // More concurrent requests
      requestTimeout: 5000, // 5 second timeout
    },
  };
  
  return configs[speed];
};

// Request queue for slow networks
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private maxConcurrent: number;
  
  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }
  
  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    const request = this.queue.shift();
    if (!request) return;
    
    this.activeRequests++;
    
    try {
      await request();
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }
  
  updateMaxConcurrent(max: number) {
    this.maxConcurrent = max;
    this.processQueue();
  }
}

// Global request queue instance
const config = getNetworkOptimizedConfig();
export const requestQueue = new RequestQueue(config.maxConcurrentRequests);

// Update queue on network change
if (typeof window !== 'undefined') {
  const connection = (navigator as any).connection;
  if (connection) {
    connection.addEventListener('change', () => {
      const newConfig = getNetworkOptimizedConfig();
      requestQueue.updateMaxConcurrent(newConfig.maxConcurrentRequests);
      console.log('🌐 Network changed, updated config:', {
        speed: getNetworkSpeed(),
        maxConcurrent: newConfig.maxConcurrentRequests,
      });
    });
  }
}

// Helper to wrap fetch with timeout and queue
export const optimizedFetch = async (
  url: string,
  options?: RequestInit
): Promise<Response> => {
  const config = getNetworkOptimizedConfig();
  const speed = getNetworkSpeed();
  
  // Log slow network
  if (speed === 'slow') {
    console.warn('⚠️ Slow network detected, using optimized fetch');
  }
  
  return requestQueue.add(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  });
};
