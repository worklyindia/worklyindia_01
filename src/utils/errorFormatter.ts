import { CategorizedError } from './errorCategorizer';

export interface FormattedError {
  id: string;
  timestamp: string;
  timeFormatted: string;
  category: CategorizedError;
  message: string;
  stack?: string;
  userContext?: {
    userId?: string;
    email?: string;
    userAgent: string;
    platform: string;
    viewport: string;
  };
  browserInfo: {
    browser: string;
    version: string;
    os: string;
  };
}

export const formatError = (
  error: Error,
  category: CategorizedError,
  errorId: string,
  userId?: string,
  userEmail?: string
): FormattedError => {
  const now = new Date();
  
  return {
    id: errorId,
    timestamp: now.toISOString(),
    timeFormatted: now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    category,
    message: error.message,
    stack: error.stack,
    userContext: {
      userId,
      email: userEmail,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
    browserInfo: getBrowserInfo(),
  };
};

export const formatErrorForClipboard = (formattedError: FormattedError): string => {
  const lines = [
    '═══════════════════════════════════════',
    `🔴 ${formattedError.category.title}`,
    '═══════════════════════════════════════',
    '',
    '📋 ERROR DETAILS',
    `Error ID: ${formattedError.id}`,
    `Time: ${formattedError.timeFormatted}`,
    `Category: ${formattedError.category.title}`,
    '',
    '💬 MESSAGE',
    formattedError.message,
    '',
  ];

  // Add category-specific details
  if (formattedError.category.details.table) {
    lines.push('📊 DATABASE INFO');
    lines.push(`Table: ${formattedError.category.details.table}`);
    if (formattedError.category.details.operation) {
      lines.push(`Operation: ${formattedError.category.details.operation}`);
    }
    if (formattedError.category.details.type) {
      lines.push(`Type: ${formattedError.category.details.type}`);
    }
    lines.push('');
  }

  if (formattedError.category.details.endpoint) {
    lines.push('🌐 NETWORK INFO');
    lines.push(`Endpoint: ${formattedError.category.details.endpoint}`);
    if (formattedError.category.details.statusCode) {
      lines.push(`Status Code: ${formattedError.category.details.statusCode}`);
    }
    lines.push('');
  }

  if (formattedError.category.details.component) {
    lines.push('⚛️ COMPONENT INFO');
    lines.push(`Component: ${formattedError.category.details.component}`);
    if (formattedError.category.details.file) {
      lines.push(`File: ${formattedError.category.details.file}`);
    }
    if (formattedError.category.details.line) {
      lines.push(`Line: ${formattedError.category.details.line}`);
    }
    lines.push('');
  }

  // User context
  if (formattedError.userContext) {
    lines.push('👤 USER CONTEXT');
    if (formattedError.userContext.email) {
      lines.push(`Email: ${formattedError.userContext.email}`);
    }
    lines.push(`Platform: ${formattedError.userContext.platform}`);
    lines.push(`Viewport: ${formattedError.userContext.viewport}`);
    lines.push('');
  }

  // Browser info
  lines.push('🌐 BROWSER INFO');
  lines.push(`Browser: ${formattedError.browserInfo.browser} ${formattedError.browserInfo.version}`);
  lines.push(`OS: ${formattedError.browserInfo.os}`);
  lines.push('');

  // Stack trace
  if (formattedError.stack) {
    lines.push('📚 STACK TRACE');
    lines.push(formattedError.stack);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
};

const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let version = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Edg')) {
    browser = 'Edge';
    version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
  }

  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, version, os };
};
