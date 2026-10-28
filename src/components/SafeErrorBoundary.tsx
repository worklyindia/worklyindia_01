import { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface SafeErrorBoundaryProps {
  children: ReactNode;
  context: string;
  fallback?: ReactNode;
}

/**
 * SafeErrorBoundary - A wrapper around ErrorBoundary that provides
 * context-specific error handling for different parts of the app
 */
const SafeErrorBoundary = ({ children, context, fallback }: SafeErrorBoundaryProps) => {
  return (
    <ErrorBoundary context={context} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

export default SafeErrorBoundary;