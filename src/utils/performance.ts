import { storageImageUrl } from "@/utils/imageUrl";

// Critical CSS extraction
export const criticalCSS = `
  html { font-family: system-ui, -apple-system, sans-serif; }
  body { margin: 0; background: #fafafa; }
  .loading { display: flex; justify-content: center; align-items: center; height: 100vh; }
`;

// Preload critical resources with priority - ULTRA-OPTIMIZED
export const preloadResources = () => {
  // Built CSS is already linked by Vite; the old storage logo no longer exists.
  const links = [
    { href: '/icons/icon-192x192.png?v=20261022', as: 'image', priority: 'high' },
  ];

  links.forEach(({ href, as, priority }) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (priority) link.setAttribute('fetchpriority', priority);
    document.head.appendChild(link);
  });

};

// Firebase messaging is the only service worker allowed at the root scope.
// Registration happens in FirebasePushService after its public config loads.
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((registration) => {
      const worker = registration.active || registration.waiting || registration.installing;
      return worker?.scriptURL.includes('/sw.js') ? registration.unregister() : Promise.resolve(false);
    }),
  );
};

// Optimize images with responsive sizing and modern formats.
// Supabase's own transform endpoint is a paid feature (403 on Free plan), so we
// route storage images through the free wsrv.nl CDN — this is what keeps
// Supabase Cached Egress low.
export const optimizeImage = (src: string, width = 400, quality = 70, _format?: string): string => {
  return storageImageUrl(src, width, quality) || src;
};

// Get optimized favicon with proper size
export const getOptimizedFavicon = (src: string, size: number = 32): string => {
  return optimizeImage(src, size, 75, 'png'); // PNG for favicon compatibility
};

// Get optimized logo for header with WebP support
export const getOptimizedLogo = (src: string, size: number = 32): string => {
  return optimizeImage(src, size, 70, 'webp');
};

// Generate responsive image sources for different screen sizes
export const generateResponsiveImageSrcSet = (src: string, sizes: number[] = [32, 48, 56]): string => {
  if (!src) return '';
  return sizes.map((s) => `${optimizeImage(src, s, 70, 'webp')} ${s}w`).join(', ');
};

// Bundle splitting helper (no-op: legacy dynamic import removed to fix Vite build error)
export const loadChunk = async (_chunkName: string) => {
  return null;
};

// Performance metrics
export const measurePerformance = (name: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  const duration = end - start;
  
  console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`);
  
  // Report slow operations to error monitoring
  if (duration > 1000) {
    console.warn(`⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
  }
  
  return duration;
};

// Memory cleanup
export const cleanupMemory = () => {
  if ('gc' in window) {
    (window as any).gc();
  }
};

// Resource hints
export const addResourceHints = () => {
  const hints = [
    { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
    { rel: 'dns-prefetch', href: '//www.googletagmanager.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
  ];

  hints.forEach(({ rel, href, crossorigin }) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (crossorigin) link.crossOrigin = crossorigin;
    document.head.appendChild(link);
  });
};