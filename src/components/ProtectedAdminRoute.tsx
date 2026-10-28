import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import ErrorFallback from "@/components/ErrorFallback";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedAdminRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'owner';
}

const ProtectedAdminRoute = ({ children, requiredRole = 'admin' }: ProtectedAdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        setError(null);
        
        // Check admin_users table directly for reliability
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (adminError) {
          console.error('Error querying admin_users:', adminError);
          throw adminError;
        }
        
        if (!adminData) {
          console.log('User not found in admin_users table');
          setIsAdmin(false);
        } else {
          // Check role requirements
          if (requiredRole === 'owner') {
            setIsAdmin(adminData.role === 'owner');
          } else {
            // admin role accepts both 'admin' and 'owner'
            setIsAdmin(['admin', 'owner'].includes(adminData.role));
          }
        }
      } catch (error: any) {
        console.error('Error checking admin status:', error);
        setError(error?.message || 'Failed to verify admin access');
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, requiredRole]);

  // Once access is confirmed, background auth re-checks must not unmount the page.
  if ((authLoading || loading) && isAdmin !== true) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return <Navigate to="/auth" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
        <ErrorFallback 
          title="Access Verification Failed"
          description={error}
          resetError={() => {
            setError(null);
            setLoading(true);
          }}
        />
      </div>
    );
  }

  if (isAdmin === false) {
    return <Navigate to="/" replace />;
  }

  // Only render children if admin access is confirmed
  if (isAdmin === true) {
    return <>{children}</>;
  }

  // This shouldn't be reached, but return loading state as fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );
};

export default ProtectedAdminRoute;