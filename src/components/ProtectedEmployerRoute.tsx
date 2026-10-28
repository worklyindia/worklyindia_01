import { ReactNode, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';

interface ProtectedEmployerRouteProps {
  children: ReactNode;
  requireCompleteProfile?: boolean;
}

const ProtectedEmployerRoute = ({ children, requireCompleteProfile = false }: ProtectedEmployerRouteProps) => {
  const { user, company, loading, companyLoading, checkCompanyCompletion, refreshCompany } = useEmployerAuth();
  const location = useLocation();
  const lastRefreshedPath = useRef<string | null>(null);

  // Refresh company data only when route actually changes (not on every render)
  useEffect(() => {
    if (user && !loading && location.pathname !== lastRefreshedPath.current) {
      console.log('🔄 Refreshing company data on route change:', location.pathname);
      lastRefreshedPath.current = location.pathname;
      refreshCompany();
    }
  }, [user, loading, location.pathname, refreshCompany]);

  // Show loading while auth or company is loading
  // Background re-checks (e.g. returning from another app to paste a value)
  // must not unmount the page — only block on the very first load.
  if ((loading || companyLoading) && !(user && company)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b bg-card/50">
          <div className="container mx-auto px-4 h-full flex items-center justify-between">
            <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
            <div className="h-8 w-24 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 space-y-4">
          <div className="h-40 bg-card border rounded-lg p-6 space-y-3">
            <div className="h-6 w-1/2 bg-muted/50 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    const currentPath = window.location.pathname + window.location.search;
    return <Navigate to={`/employer-auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  // Check if company account is banned
  if (company?.account_status === 'banned') {
    return <Navigate to="/employer-disabled" replace />;
  }

  // Handle profile completion check and redirect logic
  const currentPath = window.location.pathname;
  
  console.log('=== ProtectedEmployerRoute Check ===', {
    currentPath,
    requireCompleteProfile,
    hasUser: !!user,
    hasCompany: !!company,
    loading,
    companyLoading
  });
  
  if (company) {
    console.log('Company data in ProtectedEmployerRoute:', {
      id: company.id,
      company_name: company.company_name,
      is_profile_complete: company.is_profile_complete,
      account_status: company.account_status
    });
  }
  
  const isProfileComplete = company && checkCompanyCompletion();
  
  // Don't redirect if already on profile setup page to avoid loops
  if (currentPath.startsWith('/Employer/Setup')) {
    console.log('✅ Already on profile setup page, allowing access');
    return <>{children}</>;
  }
  
  // Only redirect if requireCompleteProfile is true AND no company exists
  if (requireCompleteProfile && !company && user) {
    console.log('🚫 Route requires complete profile but no company found - redirecting to setup');
    const fullPath = currentPath + window.location.search;
    return <Navigate to={`/Employer/Setup?redirect=${encodeURIComponent(fullPath)}`} replace />;
  }
  
  // Only redirect to profile setup if route explicitly requires complete profile AND profile is incomplete
  if (requireCompleteProfile && company && !isProfileComplete) {
    console.log('🚫 Route requires complete profile but profile is incomplete - redirecting to setup');
    const fullPath = currentPath + window.location.search;
    return <Navigate to={`/Employer/Setup?redirect=${encodeURIComponent(fullPath)}`} replace />;
  }

  // Allow access
  console.log('✅ Allowing access to route', { currentPath, hasCompany: !!company, isComplete: isProfileComplete });

  return <>{children}</>;
};

export default ProtectedEmployerRoute;