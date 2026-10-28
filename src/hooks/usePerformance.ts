import { useEffect } from 'react';

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// Performance monitoring hook
export const usePerformance = () => {
  useEffect(() => {
    // Report Core Web Vitals
    const reportWebVital = (metric: any) => {
      // Send to analytics
      if (window.gtag) {
        window.gtag('event', metric.name, {
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          event_category: 'Web Vitals',
          event_label: metric.id,
          non_interaction: true,
        });
      }
    };

    // Memory usage monitoring
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      console.log('Memory Usage:', {
        used: Math.round(memoryInfo.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(memoryInfo.totalJSHeapSize / 1048576) + ' MB',
        limit: Math.round(memoryInfo.jsHeapSizeLimit / 1048576) + ' MB'
      });
    }

    // Simple performance timing
    if (performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      console.log('Page Load Time:', loadTime + 'ms');
    }
  }, []);
};
