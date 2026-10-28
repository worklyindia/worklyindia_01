// Adsterra Ads Configuration
export const ADS_CONFIG = {
  // Enable/disable ads globally
  enabled: true,
  
  // Ad placement settings
  placements: {
    homepage: {
      afterHero: true,
      afterCategories: true,
      betweenJobs: true,
      jobInterval: 3, // Show ad after every 3rd job
    },
    jobsPage: {
      aboveSearch: true,
      betweenJobs: true,
      jobInterval: 5, // Show ad after every 5th job
      sidebar: true,
    },
    jobDetail: {
      belowDescription: true,
      belowApplication: true,
    },
  },
  
  // Performance settings
  lazyLoad: true,
  viewportMargin: '100px',
  
  // Mobile optimization
  mobile: {
    enabled: true,
    hideSidebar: true, // Hide sidebar ads on mobile
  },
};
