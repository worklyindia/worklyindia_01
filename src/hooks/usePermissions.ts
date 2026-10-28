import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PermissionCategory {
  view: boolean;
  edit?: boolean;
  delete?: boolean;
  ban?: boolean;
  export?: boolean;
  verify?: boolean;
  approve_withdrawals?: boolean;
  publish?: boolean;
  invite?: boolean;
  edit_roles?: boolean;
  remove_members?: boolean;
  create?: boolean;
  respond?: boolean;
  close_tickets?: boolean;
}

export interface UserPermissions {
  users_management: PermissionCategory;
  employers_management: PermissionCategory;
  analytics: PermissionCategory;
  financial: PermissionCategory;
  content: PermissionCategory;
  settings: PermissionCategory;
  team_management: PermissionCategory;
  packages: PermissionCategory;
  support: PermissionCategory;
  communication: PermissionCategory;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!user) return null;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_permissions', {
        p_user_id: user.id
      });

      if (error) throw error;
      const perms = data as unknown as UserPermissions;
      setPermissions(perms);
      return perms;
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkPermission = useCallback(async (permissionPath: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('has_permission', {
        p_user_id: user.id,
        p_permission_path: permissionPath
      });

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }, [user]);

  const isSuperAdmin = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data?.role === 'owner';
    } catch (error) {
      console.error('Error verifying super admin:', error);
      return false;
    }
  }, [user]);

  return {
    permissions,
    loading,
    fetchPermissions,
    checkPermission,
    isSuperAdmin
  };
}
