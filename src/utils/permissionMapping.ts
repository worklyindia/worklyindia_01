// Centralized permission mapping for Owner Portal routes
export const ROUTE_PERMISSIONS: Record<string, string> = {
  // Team Management
  '/owner-portal/team-management': 'team_management.view',
  '/owner-portal/invite-member': 'team_management.invite',
  '/owner-portal/create-role': 'team_management.edit_roles',
  
  // Analytics
  '/owner-portal/analytics-dashboard': 'analytics.view',
  '/owner-portal/seo-monitor': 'analytics.view',
  '/owner-portal/speed-monitor': 'analytics.view',
  '/owner-portal/interview-mode-analytics': 'analytics.view',
  '/owner-portal/interview-analytics': 'analytics.view',
  '/owner-portal/live-training-analytics': 'analytics.view',
  '/owner-portal/onesignal-analytics': 'analytics.view',
  '/owner-portal/onesignal/triggers': 'communication.edit',
  
  // User Management
  '/owner-portal/website-users': 'users_management.view',
  '/owner-portal/employer-members': 'employers_management.view',
  '/owner-portal/auth-users': 'users_management.view',
  
  // Financial
  '/owner-portal/revenue-tracking': 'financial.view',
  '/owner-portal/user-payments': 'financial.view',
  '/owner-portal/payment-events': 'settings.view',
  '/owner-portal/paypal-payment-events': 'settings.view',
  '/owner-portal/referral-withdrawals': 'financial.approve_withdrawals',
  '/owner-portal/competition-prizes': 'financial.edit',

  // Domain Marketplace
  '/owner-portal/domain-sales': 'financial.view',
  '/owner-portal/domain-pricing': 'settings.edit',
  '/owner-portal/domain-settings': 'settings.edit',
  
  // Packages
  '/owner-portal/points-packages': 'packages.view',
  '/owner-portal/ai-pricing': 'settings.edit',
  '/owner-portal/api-pricing': 'settings.view',
  '/owner-portal/boost-packages': 'packages.view',
  '/owner-portal/verification-packages': 'packages.view',
  '/owner-portal/ai-chat-plans': 'packages.view',
  '/owner-portal/donation-campaigns': 'financial.view',
  
  // Settings
  '/owner-portal/referral-settings': 'settings.edit',
  '/owner-portal/job-posting-settings': 'settings.view',
  '/owner-portal/interview-pricing': 'settings.view',
  
  // Content
  '/owner-portal/contact-info': 'content.edit',
  '/owner-portal/brand-management': 'content.edit',
  '/owner-portal/hero-banners': 'content.edit',
  '/owner-portal/trust-badges': 'content.edit',
  '/owner-portal/home-video': 'content.edit',
  '/owner-portal/home-image': 'content.edit',
  '/owner-portal/home-seekers-image': 'content.edit',
  '/owner-portal/push-templates': 'content.edit',
  '/owner-portal/telegram-templates': 'content.edit',
  '/owner-portal/telegram-bot-settings': 'content.edit',
  '/owner-portal/email-templates': 'content.edit',
  '/owner-portal/verify-otp': 'content.edit',

  
  // AI Content
  '/owner-portal/ai-tricks': 'content.edit',
  '/owner-portal/ai-chat-settings': 'content.edit',
  
  // AI Monitoring
  '/owner-portal/ai-access-monitoring': 'analytics.view',
  '/owner-portal/user-data-access-logs': 'analytics.view',
  
  // Support
  '/owner-portal/support-tickets': 'support.view',
  '/owner-portal/workly-email': 'support.view',
  '/owner-portal/customer-service': 'settings.view',
  
  // Referral Marketing
  '/owner-portal/referral-marketing': 'content.edit',
  
  // Site Settings (Admin Settings)
  '/admin-settings': 'settings.edit',
  
  // Notifications
  
  // Owner Portal Home
  '/owner-portal': 'analytics.view',
  
  // WhatsApp Communication
  '/owner-portal/whatsapp/chat': 'communication.view',
  '/owner-portal/whatsapp/templates': 'communication.view',
  '/owner-portal/whatsapp/settings': 'communication.edit',
  
  // Email Auto-Triggers
  '/owner-portal/email/auto-triggers': 'communication.edit',
  
  // Development (Owner Only)
  '/owner-portal/secrets': 'settings.edit',
  '/owner-portal/function-logs': 'settings.view',
  '/owner-portal/api-docs': 'settings.view',
  '/owner-portal/supabase-usage': 'analytics.view',
  '/owner-portal/storage': 'settings.edit',
  '/owner-portal/cloudflare-storage': 'settings.edit',

  
  // Google Cloud Integrations
  '/owner-portal/google-integrations': 'analytics.view',
};

// Owner-only routes that require super admin status
export const OWNER_ONLY_ROUTES = [
  '/owner-portal/team-management',
  '/owner-portal/invite-member',
  '/owner-portal/create-role',
  '/owner-portal/secrets',
  '/owner-portal/auth-users',
  '/owner-portal/ai-pricing',
  '/owner-portal/payment-events',
  '/owner-portal/paypal-payment-events',
  '/owner-portal/storage',
  '/owner-portal/cloudflare-storage',

];

// Get permission for a route
export const getRoutePermission = (path: string): string | null => {
  return ROUTE_PERMISSIONS[path] || null;
};

// Check if route is owner-only
export const isOwnerOnlyRoute = (path: string): boolean => {
  return OWNER_ONLY_ROUTES.includes(path);
};

export const isPaymentEventsMenuVisible = (path: string, isOwner: boolean): boolean =>
  !["/owner-portal/payment-events", "/owner-portal/paypal-payment-events"].includes(path) || isOwner;
