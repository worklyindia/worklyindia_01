import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PermissionDeniedError } from "@/components/PermissionDeniedError";
import ProtectedAdminRoute from "@/components/ProtectedAdminRoute";
import { isOwnerOnlyRoute } from "@/utils/permissionMapping";

interface ProtectedPermissionRouteProps {
  children: ReactNode;
  requiredPermission: string;
  ownerOnly?: boolean;
}

export const ProtectedPermissionRoute = ({ 
  children, 
  requiredPermission,
  ownerOnly = false
}: ProtectedPermissionRouteProps) => {
  const { user } = useAuth();
  const userId = user?.id;
  const location = useLocation();
  const { checkPermission, isSuperAdmin } = usePermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine if this is an owner-only route
  const requiresOwner = ownerOnly || isOwnerOnlyRoute(location.pathname);

  useEffect(() => {
    const verifyPermission = async () => {
      if (!userId) {
        setHasPermission(false);
        setLoading(false);
        return;
      }

      try {
        // Re-checks (returning to the tab) run silently so the open page never unmounts.
        if (hasPermission === null) setLoading(true);
        
        // Check if owner-only route
        if (requiresOwner) {
          const ownerStatus = await isSuperAdmin();
          setIsOwner(ownerStatus);
          setHasPermission(ownerStatus);
        } else {
          // Check specific permission
          const permission = await checkPermission(requiredPermission);
          setHasPermission(permission);
          
          // Also check if user is owner (they have all permissions)
          const ownerStatus = await isSuperAdmin();
          setIsOwner(ownerStatus);
          
          // If not permitted but is owner, grant access
          if (!permission && ownerStatus) {
            setHasPermission(true);
          }
        }
      } catch (error) {
        console.error('Error checking permission:', error);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    verifyPermission();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, requiredPermission, requiresOwner, checkPermission, isSuperAdmin, location.pathname]);

  // Wrap in ProtectedAdminRoute first (checks basic admin access)
  return (
    <ProtectedAdminRoute requiredRole={requiresOwner ? 'owner' : 'admin'}>
      {loading ? (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      ) : hasPermission ? (
        <>{children}</>
      ) : (
        <PermissionDeniedError 
          title="Access Denied"
          message={
            requiresOwner 
              ? "This page is only accessible to the platform owner."
              : "You don't have the required permissions to access this page. Please contact your administrator if you need access."
          }
        />
      )}
    </ProtectedAdminRoute>
  );
};
