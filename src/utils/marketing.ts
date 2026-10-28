// Marketing Tools Integration

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
    clarity?: (...args: any[]) => void;
  }
}

// Meta Pixel Events
export const trackMetaPixelEvent = (eventName: string, data?: Record<string, any>) => {
  if (window.fbq) {
    window.fbq('track', eventName, data);
  }
};

export const trackMetaPageView = () => {
  if (window.fbq) {
    window.fbq('track', 'PageView');
  }
};

export const trackMetaLead = (data?: Record<string, any>) => {
  trackMetaPixelEvent('Lead', data);
};

export const trackMetaCompleteRegistration = (data?: Record<string, any>) => {
  trackMetaPixelEvent('CompleteRegistration', data);
};

export const trackMetaSearch = (searchString: string) => {
  trackMetaPixelEvent('Search', { search_string: searchString });
};

export const trackMetaViewContent = (contentName: string, contentCategory?: string) => {
  trackMetaPixelEvent('ViewContent', {
    content_name: contentName,
    content_category: contentCategory,
  });
};

export const trackMetaSubmitApplication = (data?: Record<string, any>) => {
  trackMetaPixelEvent('SubmitApplication', data);
};

// Microsoft Clarity Events
export const trackClarityEvent = (eventName: string, properties?: Record<string, any>) => {
  if (window.clarity) {
    window.clarity('event', eventName, properties);
  }
};

export const setClarityTag = (key: string, value: string) => {
  if (window.clarity) {
    window.clarity('set', key, value);
  }
};

// Initialize Marketing Tools
export const initializeMarketingTools = () => {
  console.log('✅ Marketing tools ready (Meta Pixel & Microsoft Clarity)');
  
  // Track initial page view for Meta Pixel
  trackMetaPageView();
};
