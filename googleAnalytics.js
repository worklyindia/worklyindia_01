import ReactGA from "react-ga4";

// GA4 Measurement ID - Unified across the app
const GA4_MEASUREMENT_ID = "G-NHX89HXZVZ";

// Initialize GA4 with enhanced configuration
export const initGA = () => {
  ReactGA.initialize(GA4_MEASUREMENT_ID, {
    gaOptions: {
      cookieFlags: 'SameSite=None;Secure',
      anonymizeIp: true, // GDPR compliance
    },
    gtagOptions: {
      send_page_view: false // We'll handle page views manually for better control
    }
  });
  
  console.log('✅ Google Analytics 4 initialized with ID:', GA4_MEASUREMENT_ID);
};

// Log Page View with enhanced tracking
export const logPageView = (page) => {
  ReactGA.send({ 
    hitType: "pageview", 
    page,
    title: document.title
  });
  
  // Also send to gtag if available for redundancy
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: page,
      page_title: document.title
    });
  }
};
