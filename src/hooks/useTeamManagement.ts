import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getClientInfo } from "@/utils/clientInfo";

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
}

export interface TeamMember {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  permissions: any;
  last_sign_in_at: string;
  created_at: string;
  avatar_url?: string;
  phone?: string;
  location?: string;
}

export interface UserSearchResult {
  user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_admin: boolean;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  admin_email: string;
  admin_name: string;
  action_type: string;
  target_user_id: string | null;
  target_email: string | null;
  changes: any;
  ip_address: string | null;
  logged_at: string;
}

export interface TeamRole {
  id: string;
  role_name: string;
  role_description: string;
  base_permissions: any;
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useTeamManagement() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time subscription for team changes
  useEffect(() => {
    const channel = supabase
      .channel('team-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_users' },
        (payload) => {
          console.log('Team member change detected:', payload);
          fetchTeamMembers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_permissions' },
        (payload) => {
          console.log('Permissions change detected:', payload);
          fetchTeamMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the fixed RPC function that properly handles JOINs and email retrieval
      const { data, error: rpcError } = await supabase.rpc('get_team_members');

      if (rpcError) {
        // Fallback to manual query if RPC fails
        console.warn('RPC failed, using fallback:', rpcError);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Authentication required');
        }

        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!adminCheck || !['admin', 'owner'].includes(adminCheck.role)) {
          throw new Error('Admin access required');
        }

        const { data: adminUsers, error: adminError } = await supabase
          .from('admin_users')
          .select('*')
          .order('created_at', { ascending: false });

        if (adminError) throw adminError;

        const userIds = adminUsers?.map(au => au.user_id) || [];
        
        // Fetch emails from auth.users using admin query
        const { data: authData } = await supabase.auth.admin.listUsers();
        const emailMap = new Map<string, string>();
        if (authData?.users) {
          (authData.users as any[]).forEach((u: any) => {
            if (u.email && u.id) emailMap.set(u.id, u.email);
          });
        }
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, profile_image_url, phone, location')
          .in('user_id', userIds);

        const { data: permissions } = await supabase
          .from('admin_permissions')
          .select('user_id, permissions')
          .in('user_id', userIds);

        const teamData = adminUsers?.map(au => {
          const profile = profiles?.find(p => p.user_id === au.user_id);
          const perms = permissions?.find(p => p.user_id === au.user_id);
          const email = emailMap.get(au.user_id) || au.user_id;
          
          return {
            user_id: au.user_id,
            email: email,
            full_name: profile?.full_name || 'Unknown User',
            role: au.role,
            permissions: perms?.permissions || {},
            last_sign_in_at: au.created_at,
            created_at: au.created_at || new Date().toISOString(),
            avatar_url: profile?.profile_image_url,
            phone: profile?.phone,
            location: profile?.location
          };
        }) || [];

        setTeamMembers(teamData);
      } else {
        // Use RPC result with proper email and last_sign_in_at
        const teamData = data?.map((member: any) => ({
          user_id: member.user_id,
          email: member.email,
          full_name: member.full_name,
          role: member.role,
          permissions: member.permissions || {},
          last_sign_in_at: member.last_sign_in_at,
          created_at: member.created_at,
          avatar_url: member.profile_image_url,
          phone: member.phone,
          location: member.location
        })) || [];

        setTeamMembers(teamData);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch team members';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (limit = 100) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase.rpc('get_audit_logs', {
        p_limit: limit,
        p_offset: 0
      });

      if (fetchError) throw fetchError;
      
      // Map the response to AuditLog format with correct column names
      const mappedLogs = (data || []).map((log: any) => ({
        id: log.id,
        admin_user_id: log.admin_user_id,
        admin_email: log.admin_email,
        admin_name: log.admin_name,
        action_type: log.action_type,
        target_user_id: log.target_user_id,
        target_email: log.target_email,
        changes: log.changes || {},
        ip_address: log.ip_address,
        logged_at: log.logged_at
      }));
      
      setAuditLogs(mappedLogs);
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch audit logs';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeamRoles = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('team_roles')
        .select('*')
        .order('is_custom', { ascending: true })
        .order('role_name', { ascending: true });

      if (fetchError) throw fetchError;
      setTeamRoles(data || []);
    } catch (err: any) {
      console.error('Error fetching team roles:', err);
    }
  }, []);

  // Fetch team roles on initialization
  useEffect(() => {
    fetchTeamRoles();
  }, [fetchTeamRoles]);

  const assignRole = useCallback(async (
    targetUserId: string,
    role: string,
    permissions: any
  ) => {
    try {
      setLoading(true);
      const { error: assignError } = await supabase.rpc('assign_role_to_user', {
        p_target_user_id: targetUserId,
        p_role: role,
        p_permissions: permissions
      });

      if (assignError) {
        if (assignError.message.includes('Rate limit exceeded')) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        if (assignError.message.includes('MFA verification required')) {
          throw new Error('This action requires multi-factor authentication. Please verify your identity first.');
        }
        if (assignError.message.includes('Not authenticated')) {
          throw new Error('You must be logged in to assign roles');
        }
        if (assignError.message.includes('permission')) {
          throw new Error('You do not have permission to assign roles');
        }
        if (assignError.message.includes('already has an admin role')) {
          throw new Error('This user already has an admin role');
        }
        if (assignError.message.includes('higher role')) {
          throw new Error('You cannot assign a role higher than your own');
        }
        throw assignError;
      }

      toast.success('Role assigned successfully');
      await fetchTeamMembers();
    } catch (err: any) {
      const message = err?.message || 'Failed to assign role';
      console.error('Error assigning role:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeamMembers]);

  const updatePermissions = useCallback(async (
    targetUserId: string,
    permissions: any
  ) => {
    try {
      setLoading(true);
      const { error: updateError } = await supabase.rpc('update_team_member_permissions', {
        p_target_user_id: targetUserId,
        p_permissions: permissions
      });

      if (updateError) {
        if (updateError.message.includes('Rate limit exceeded')) {
          throw new Error('Too many requests. Please slow down and try again.');
        }
        if (updateError.message.includes('MFA verification required')) {
          throw new Error('This action requires multi-factor authentication. Please verify your identity first.');
        }
        if (updateError.message.includes('Not authenticated')) {
          throw new Error('You must be logged in to update permissions');
        }
        if (updateError.message.includes('permission')) {
          throw new Error('You do not have permission to update permissions');
        }
        if (updateError.message.includes('higher role')) {
          throw new Error('You cannot modify permissions for users with a higher role than yours');
        }
        throw updateError;
      }

      toast.success('Permissions updated successfully');
      await fetchTeamMembers();
    } catch (err: any) {
      const message = err?.message || 'Failed to update permissions';
      console.error('Error updating permissions:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeamMembers]);

  const removeMember = useCallback(async (targetUserId: string) => {
    try {
      setLoading(true);
      const { error: removeError } = await supabase.rpc('remove_team_member', {
        p_target_user_id: targetUserId
      });

      if (removeError) {
        if (removeError.message.includes('Rate limit exceeded')) {
          throw new Error('Too many removal requests. Please wait before trying again.');
        }
        if (removeError.message.includes('MFA verification required')) {
          throw new Error('Removing team members requires multi-factor authentication. Please verify your identity first.');
        }
        if (removeError.message.includes('last owner')) {
          throw new Error('Cannot remove the last owner. At least one owner must remain.');
        }
        if (removeError.message.includes('Not authenticated')) {
          throw new Error('You must be logged in to remove team members');
        }
        if (removeError.message.includes('permission')) {
          throw new Error('You do not have permission to remove team members');
        }
        if (removeError.message.includes('higher role')) {
          throw new Error('You cannot remove users with a higher role than yours');
        }
        if (removeError.message.includes('Cannot remove yourself')) {
          throw new Error('You cannot remove yourself from the team');
        }
        throw removeError;
      }

      toast.success('Team member removed successfully');
      await fetchTeamMembers();
    } catch (err: any) {
      const message = err?.message || 'Failed to remove team member';
      console.error('Error removing team member:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeamMembers]);

  const createCustomRole = useCallback(async (
    roleName: string,
    roleDescription: string,
    permissions: any
  ) => {
    try {
      setLoading(true);
      const { error: createError } = await supabase.rpc('create_custom_role', {
        p_role_name: roleName,
        p_role_description: roleDescription,
        p_permissions: permissions
      });

      if (createError) {
        if (createError.message.includes('duplicate')) {
          throw new Error('A role with this name already exists');
        }
        if (createError.message.includes('Not authenticated')) {
          throw new Error('You must be logged in to create custom roles');
        }
        if (createError.message.includes('permission')) {
          throw new Error('You do not have permission to create custom roles');
        }
        throw createError;
      }

      toast.success('Custom role created successfully');
      await fetchTeamRoles();
    } catch (err: any) {
      const message = err?.message || 'Failed to create custom role';
      console.error('Error creating custom role:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeamRoles]);

  const searchUsersByEmail = useCallback(async (searchTerm: string): Promise<UserSearchResult[]> => {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      const { data, error: searchError } = await supabase.rpc('search_users_by_email', {
        search_query: searchTerm
      });

      if (searchError) throw searchError;
      
      // Map the returned data to match UserSearchResult interface
      return (data || []).map((user: any) => ({
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_admin: false // Will be checked separately if needed
      }));
    } catch (err: any) {
      console.error('Error searching users:', err);
      return [];
    }
  }, []);

  const changeRole = useCallback(async (
    targetUserId: string,
    newRole: string,
    preservePermissions: boolean = false
  ) => {
    try {
      setLoading(true);
      const { error: changeError } = await supabase.rpc('change_team_member_role', {
        p_target_user_id: targetUserId,
        p_new_role: newRole,
        p_preserve_custom_permissions: preservePermissions
      });

      if (changeError) {
        if (changeError.message.includes('higher role')) {
          throw new Error('You cannot modify users with a higher role or assign roles higher than yours');
        }
        throw changeError;
      }

      toast.success('Role changed successfully');
      await fetchTeamMembers();
    } catch (err: any) {
      const message = err?.message || 'Failed to change role';
      console.error('Error changing role:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeamMembers]);

  const bulkUpdatePermissions = useCallback(async (
    userIds: string[],
    permissions: any
  ) => {
    try {
      setLoading(true);
      const { data, error: bulkError } = await supabase.rpc('bulk_update_permissions', {
        p_user_ids: userIds,
        p_permissions: permissions
      });

      if (bulkError) throw bulkError;

      toast.success(`Updated permissions for ${data} members`);
      await fetchTeamMembers();
      return data;
    } catch (err: any) {
      const message = err?.message || 'Failed to bulk update permissions';
      console.error('Error bulk updating permissions:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeamMembers]);

  const exportAuditLogs = useCallback(async (
    startDate: Date | null,
    endDate: Date | null,
    actionType: string | null
  ) => {
    try {
      setLoading(true);
      const { data, error: exportError } = await supabase.rpc('export_audit_logs', {
        p_start_date: startDate?.toISOString(),
        p_end_date: endDate?.toISOString(),
        p_action_type: actionType
      });

      if (exportError) throw exportError;

      // Convert to CSV
      if (data && data.length > 0) {
        const headers = ['Date', 'Admin Email', 'Admin Name', 'Action Type', 'Target Email', 'IP Address', 'Changes'];
        const rows = data.map((log: any) => [
          new Date(log.logged_at).toLocaleString(),
          log.admin_email,
          log.admin_name,
          log.action_type,
          log.target_email || 'N/A',
          log.ip_address || 'N/A',
          JSON.stringify(log.changes)
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to export audit logs';
      console.error('Error exporting audit logs:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCustomRole = useCallback(async (roleId: string) => {
    try {
      setLoading(true);
      const { error: deleteError } = await supabase.rpc('delete_custom_role', {
        p_role_id: roleId
      });

      if (deleteError) {
        if (deleteError.message.includes('Cannot delete system roles')) {
          throw new Error('System roles (admin, owner, moderator, support) cannot be deleted');
        }
        if (deleteError.message.includes('member(s) currently have this role')) {
          throw new Error(deleteError.message);
        }
        if (deleteError.message.includes('Not authenticated')) {
          throw new Error('You must be logged in to delete custom roles');
        }
        if (deleteError.message.includes('permission') || deleteError.message.includes('Unauthorized')) {
          throw new Error('You do not have permission to delete custom roles');
        }
        if (deleteError.message.includes('Role not found')) {
          throw new Error('Role not found');
        }
        throw deleteError;
      }

      toast.success('Custom role deleted successfully');
      await fetchTeamRoles();
    } catch (err: any) {
      const message = err?.message || 'Failed to delete custom role';
      console.error('Error deleting custom role:', err);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeamRoles]);

  return {
    teamMembers,
    auditLogs,
    teamRoles,
    loading,
    error,
    fetchTeamMembers,
    fetchAuditLogs,
    fetchTeamRoles,
    assignRole,
    updatePermissions,
    removeMember,
    createCustomRole,
    deleteCustomRole,
    searchUsersByEmail,
    changeRole,
    bulkUpdatePermissions,
    exportAuditLogs
  };
}
