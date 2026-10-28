import { ErrorMonitor } from './errorMonitoring';

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private errorMonitor = ErrorMonitor.getInstance();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Measure function execution time
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      
      // Report slow operations
      if (duration > 2000) {
        this.errorMonitor.reportPerformanceIssue({
          type: 'slow_component',
          details: {
            name,
            duration: Math.round(duration),
            threshold: 2000
          },
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration);
      throw error;
    }
  }

  /**
   * Measure synchronous function execution time
   */
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration);
      throw error;
    }
  }

  /**
   * Record metric value
   */
  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metrics = this.metrics.get(name)!;
    metrics.push(value);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Get average metric value
   */
  getAverageMetric(name: string): number {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return 0;
    
    const sum = metrics.reduce((a, b) => a + b, 0);
    return sum / metrics.length;
  }

  /**
   * Get all metrics summary
   */
  getMetricsSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, any> = {};
    
    this.metrics.forEach((values, name) => {
      if (values.length > 0) {
        summary[name] = {
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          min: Math.round(Math.min(...values)),
          max: Math.round(Math.max(...values)),
          count: values.length
        };
      }
    });
    
    return summary;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
  }

  /**
   * Monitor Core Web Vitals
   */
  monitorWebVitals() {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint (LCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      const lcp = lastEntry.renderTime || lastEntry.loadTime;
      
      console.log('📊 LCP:', Math.round(lcp), 'ms');
      this.recordMetric('web_vital_lcp', lcp);

      if (lcp > 2500) {
        this.errorMonitor.reportPerformanceIssue({
          type: 'slow_component',
          details: {
            name: 'LCP (Largest Contentful Paint)',
            duration: Math.round(lcp),
            threshold: 2500,
            rating: lcp > 4000 ? 'poor' : 'needs-improvement'
          },
          timestamp: new Date().toISOString()
        });
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;
        console.log('📊 FID:', Math.round(fid), 'ms');
        this.recordMetric('web_vital_fid', fid);

        if (fid > 100) {
          this.errorMonitor.reportPerformanceIssue({
            type: 'slow_component',
            details: {
              name: 'FID (First Input Delay)',
              duration: Math.round(fid),
              threshold: 100,
              rating: fid > 300 ? 'poor' : 'needs-improvement'
            },
            timestamp: new Date().toISOString()
          });
        }
      });
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      console.log('📊 CLS:', clsValue.toFixed(3));
      this.recordMetric('web_vital_cls', clsValue);

      if (clsValue > 0.1) {
        this.errorMonitor.reportPerformanceIssue({
          type: 'slow_component',
          details: {
            name: 'CLS (Cumulative Layout Shift)',
            duration: parseFloat(clsValue.toFixed(3)),
            threshold: 0.1,
            rating: clsValue > 0.25 ? 'poor' : 'needs-improvement'
          },
          timestamp: new Date().toISOString()
        });
      }
    }).observe({ entryTypes: ['layout-shift'] });
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// Initialize web vitals monitoring
if (typeof window !== 'undefined') {
  performanceMonitor.monitorWebVitals();
}
