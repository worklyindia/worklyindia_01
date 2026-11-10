export type ErrorCategory = 'database' | 'network' | 'authentication' | 'component';

export interface CategorizedError {
  category: ErrorCategory;
  title: string;
  color: string;
  icon: string;
  details: {
    type?: string;
    table?: string;
    operation?: string;
    endpoint?: string;
    statusCode?: number;
    component?: string;
    file?: string;
    line?: number;
    authProvider?: string;
  };
}

export const categorizeError = (error: Error, context?: string): CategorizedError => {
  const message = error.message?.toLowerCase() || '';
  const stack = error.stack || '';

  // Database/Supabase Errors
  if (
    message.includes('supabase') ||
    message.includes('postgres') ||
    message.includes('rls') ||
    message.includes('policy') ||
    message.includes('permission denied') ||
    message.includes('relation') ||
    message.includes('column') ||
    message.includes('table') ||
    message.includes('database')
  ) {
    const table = extractTableName(message, stack);
    const operation = extractOperation(message, stack);
    
    return {
      category: 'database',
      title: 'Database Error',
      color: 'hsl(var(--chart-1))', // Blue
      icon: 'Database',
      details: {
        type: extractErrorType(message),
        table,
        operation,
      },
    };
  }

  // Network Errors
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('cors') ||
    error.name === 'NetworkError'
  ) {
    return {
      category: 'network',
      title: 'Network Error',
      color: 'hsl(var(--chart-2))', // Orange
      icon: 'Wifi',
      details: {
        type: extractNetworkErrorType(message),
        endpoint: extractEndpoint(stack),
        statusCode: extractStatusCode(message),
      },
    };
  }

  // Authentication Errors
  if (
    message.includes('auth') ||
    message.includes('login') ||
    message.includes('session') ||
    message.includes('token') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    context?.includes('auth')
  ) {
    return {
      category: 'authentication',
      title: 'Authentication Error',
      color: 'hsl(var(--destructive))', // Red
      icon: 'Lock',
      details: {
        type: extractAuthErrorType(message),
        authProvider: extractAuthProvider(message, stack),
      },
    };
  }

  // Component/React Errors (default)
  return {
    category: 'component',
    title: 'Component Error',
    color: 'hsl(var(--chart-3))', // Purple
    icon: 'Code',
    details: {
      type: 'React Error',
      component: extractComponentName(stack),
      file: extractFileName(stack),
      line: extractLineNumber(stack),
    },
  };
};

// Helper functions
const extractTableName = (message: string, stack: string): string | undefined => {
  const tableMatch = message.match(/table[:\s]+["']?(\w+)["']?/i);
  if (tableMatch) return tableMatch[1];
  
  const relationMatch = message.match(/relation[:\s]+["']?(\w+)["']?/i);
  if (relationMatch) return relationMatch[1];
  
  return undefined;
};

const extractOperation = (message: string, stack: string): string | undefined => {
  const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'UPSERT'];
  const upperMessage = message.toUpperCase();
  
  for (const op of operations) {
    if (upperMessage.includes(op)) return op;
  }
  
  return undefined;
};

const extractErrorType = (message: string): string => {
  if (message.includes('rls') || message.includes('policy')) return 'RLS Policy Violation';
  if (message.includes('permission denied')) return 'Permission Denied';
  if (message.includes('not found') || message.includes('does not exist')) return 'Not Found';
  if (message.includes('unique') || message.includes('duplicate')) return 'Duplicate Entry';
  if (message.includes('foreign key')) return 'Foreign Key Constraint';
  if (message.includes('null')) return 'Null Constraint Violation';
  return 'Database Query Error';
};

const extractNetworkErrorType = (message: string): string => {
  if (message.includes('timeout')) return 'Request Timeout';
  if (message.includes('offline')) return 'Offline';
  if (message.includes('cors')) return 'CORS Error';
  if (message.includes('failed to fetch')) return 'Connection Failed';
  return 'Network Error';
};

const extractAuthErrorType = (message: string): string => {
  if (message.includes('session')) return 'Session Expired';
  if (message.includes('invalid')) return 'Invalid Credentials';
  if (message.includes('unauthorized')) return 'Unauthorized';
  if (message.includes('forbidden')) return 'Forbidden';
  if (message.includes('token')) return 'Token Invalid';
  return 'Authentication Failed';
};

const extractEndpoint = (stack: string): string | undefined => {
  const urlMatch = stack.match(/https?:\/\/[^\s)]+/);
  return urlMatch ? urlMatch[0] : undefined;
};

const extractStatusCode = (message: string): number | undefined => {
  const codeMatch = message.match(/\b[45]\d{2}\b/);
  return codeMatch ? parseInt(codeMatch[0]) : undefined;
};

const extractAuthProvider = (message: string, stack: string): string | undefined => {
  if (message.includes('google')) return 'Google';
  if (message.includes('github')) return 'GitHub';
  if (message.includes('email')) return 'Email';
  return undefined;
};

const extractComponentName = (stack: string): string | undefined => {
  const componentMatch = stack.match(/at (\w+) \(/);
  return componentMatch ? componentMatch[1] : undefined;
};

const extractFileName = (stack: string): string | undefined => {
  const fileMatch = stack.match(/\(([^)]+\.tsx?)/);
  if (fileMatch) {
    const path = fileMatch[1];
    return path.split('/').pop();
  }
  return undefined;
};

const extractLineNumber = (stack: string): number | undefined => {
  const lineMatch = stack.match(/:(\d+):\d+\)/);
  return lineMatch ? parseInt(lineMatch[1]) : undefined;
};
