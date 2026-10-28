import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompleteProfile?: boolean;
}

const ProtectedRoute = ({ children, requireCompleteProfile = false }: ProtectedRouteProps) => {
  const { user, profile, loading, profileLoading, checkProfileCompletion, isBanned } = useAuth();

  // Show loading until both auth and profile are resolved (when profile is required)
  if ((loading || (requireCompleteProfile && profileLoading)) && !(user && profile)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b bg-card/50">
          <div className="container mx-auto px-4 h-full flex items-center justify-between">
            <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-muted/50 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-card border rounded-lg p-4 space-y-2">
              <div className="h-5 w-3/4 bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-muted/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    // Only redirect if not loading - prevent redirects during refresh
    if (!loading) {
      const currentPath = window.location.pathname + window.location.search;
      return <Navigate to={`/auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
    }
    // Show loading during auth resolution
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b bg-card/50">
          <div className="container mx-auto px-4 h-full flex items-center">
            <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Check if user is banned and redirect to banned page
  if (user && profile && isBanned()) {
    return <Navigate to="/banned" replace />;
  }

  // Check for profile completion and redirect if incomplete (no verification screen)
  if (requireCompleteProfile && (!profile || !checkProfileCompletion())) {
    const currentPath = window.location.pathname + window.location.search;
    return <Navigate to={`/JobSeeker/Setup?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
