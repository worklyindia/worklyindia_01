import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Search, 
  Trash2, 
  RefreshCw, 
  Users, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Ban,
  Unlock,
  Phone,
  Mail,
  Calendar,
  Clock,
  Key,
  Globe,
  ShieldCheck,
  ShieldOff,
  Eye,
  Copy,
  Fingerprint,
  Monitor,
  AlertOctagon,
  UserX
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  banned_until: string | null;
  role: string;
  aud: string;
  avatar_url: string | null;
  full_name: string | null;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
  providers: string[];
  identities: Array<{
    provider: string;
    identity_id: string;
    created_at: string;
    last_sign_in_at: string;
    identity_data?: Record<string, any>;
  }>;
  factors: any[];
  confirmed_at: string | null;
  invited_at: string | null;
  recovery_sent_at: string | null;
  is_anonymous: boolean;
}

interface BlockedAccountRow {
  id: string;
  user_id: string;
  original_user_id: string;
  reason: string;
  block_signals: any;
  device_id: string | null;
  fingerprint_hash: string | null;
  canvas_fingerprint: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

const OWNER_EMAIL = "gohilvishal7600@gmail.com";

const getAuthUserAvatar = (user?: Partial<AuthUser> | null): string | undefined => {
  const meta = user?.user_metadata || {};
  const direct = user?.avatar_url || meta.avatar_url || meta.picture || meta.picture_url || meta.avatar || meta.profile_picture || meta.profile_image_url;
  if (direct) return direct;
  const identityAvatar = (user?.identities || [])
    .map((identity: any) => identity?.identity_data || {})
    .map((data: any) => data.avatar_url || data.picture || data.picture_url || data.avatar)
    .find(Boolean);
  return identityAvatar || undefined;
};

export default function AuthUsersManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AuthUser | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [banningUser, setBanningUser] = useState<string | null>(null);
  const [blockedAccountsMap, setBlockedAccountsMap] = useState<Map<string, BlockedAccountRow>>(new Map());
  const [duplicateSheetUser, setDuplicateSheetUser] = useState<AuthUser | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'original' | 'duplicate' | 'banned'>('all');
  const [autoBanEnabled, setAutoBanEnabled] = useState(true);
  const [autoBanLoading, setAutoBanLoading] = useState(false);
  const [screenBlockEnabled, setScreenBlockEnabled] = useState(true);
  const [screenBlockLoading, setScreenBlockLoading] = useState(false);
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [autoDeleteLoading, setAutoDeleteLoading] = useState(false);
  const [autoDeleteConfirmOpen, setAutoDeleteConfirmOpen] = useState(false);
  const [removingDuplicate, setRemovingDuplicate] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthUsers();
    fetchAutoBanSetting();
    fetchScreenBlockSetting();
    fetchAutoDeleteSetting();
  }, []);

  useEffect(() => {
    let result = users;
    
    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter((user) => 
        user.email?.toLowerCase().includes(query) ||
        user.full_name?.toLowerCase().includes(query) ||
        user.phone?.includes(query)
      );
    }
    
    // Apply tab filter
    if (filterTab === 'original') {
      result = result.filter(u => !blockedAccountsMap.has(u.id) && !u.banned_until);
    } else if (filterTab === 'duplicate') {
      result = result.filter(u => blockedAccountsMap.has(u.id));
    } else if (filterTab === 'banned') {
      result = result.filter(u => !!u.banned_until);
    }
    
    setFilteredUsers(result);
  }, [searchQuery, users, filterTab, blockedAccountsMap]);

  const fetchAuthUsers = async () => {
    setLoading(true);
    try {
      // Fetch auth users and blocked accounts in parallel
      const [usersResponse, blockedResponse] = await Promise.all([
        supabase.functions.invoke('admin-delete-auth-users', {
          body: { action: 'list' }
        }),
        supabase.rpc('get_blocked_accounts_for_admin')
      ]);

      if (usersResponse.error) throw usersResponse.error;

      if (usersResponse.data?.users) {
        setUsers(usersResponse.data.users);
        setFilteredUsers(usersResponse.data.users);
      }

      // Build blocked accounts map
      if (blockedResponse.error) {
        console.error('Error fetching blocked accounts:', blockedResponse.error);
      }
      if (blockedResponse.data) {
        const map = new Map<string, BlockedAccountRow>();
        (blockedResponse.data as any[]).forEach((row: any) => {
          map.set(row.user_id, row as BlockedAccountRow);
        });
        setBlockedAccountsMap(map);
        console.log('Blocked accounts loaded:', map.size);
      }
    } catch (error: any) {
      console.error('Error fetching auth users:', error);
      toast.error("Failed to fetch auth users: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: AuthUser) => {
    if (user.email === OWNER_EMAIL) {
      toast.error("Cannot delete owner account!");
      return;
    }
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-auth-users', {
        body: { 
          action: 'delete',
          userIds: [userToDelete.id]
        }
      });

      if (error) throw error;

      toast.success(`User ${userToDelete.email} deleted successfully`);
      setUsers(users.filter(u => u.id !== userToDelete.id));
      // Clean up blocked accounts map for deleted user
      setBlockedAccountsMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(userToDelete.id);
        // Also remove entries where this user was the original
        for (const [key, val] of newMap) {
          if (val.original_user_id === userToDelete.id) {
            newMap.delete(key);
          }
        }
        return newMap;
      });
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToDelete.id);
        return newSet;
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error("Failed to delete user: " + error.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleBanUser = async (user: AuthUser) => {
    if (user.email === OWNER_EMAIL) {
      toast.error("Cannot ban owner account!");
      return;
    }

    const isBanned = !!user.banned_until;
    setBanningUser(user.id);

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-auth-users', {
        body: { 
          action: isBanned ? 'unban' : 'ban',
          userId: user.id
        }
      });

      if (error) throw error;

      toast.success(`User ${user.email} ${isBanned ? 'unbanned' : 'banned'} successfully`);
      
      setUsers(users.map(u => {
        if (u.id === user.id) {
          return {
            ...u,
            banned_until: isBanned ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
          };
        }
        return u;
      }));
    } catch (error: any) {
      console.error('Error banning/unbanning user:', error);
      toast.error(`Failed to ${isBanned ? 'unban' : 'ban'} user: ` + error.message);
    } finally {
      setBanningUser(null);
    }
  };

  const handleBulkDelete = () => {
    const usersToDelete = users.filter(u => selectedUsers.has(u.id) && u.email !== OWNER_EMAIL);
    if (usersToDelete.length === 0) {
      toast.error("No users selected for deletion (owner account excluded)");
      return;
    }
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    const userIdsToDelete = Array.from(selectedUsers).filter(id => {
      const user = users.find(u => u.id === id);
      return user && user.email !== OWNER_EMAIL;
    });

    if (userIdsToDelete.length === 0) {
      toast.error("No users to delete");
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-auth-users', {
        body: { 
          action: 'delete',
          userIds: userIdsToDelete
        }
      });

      if (error) throw error;

      toast.success(`${userIdsToDelete.length} users deleted successfully`);
      setUsers(users.filter(u => !userIdsToDelete.includes(u.id)));
      // Clean up blocked accounts map for deleted users
      setBlockedAccountsMap(prev => {
        const newMap = new Map(prev);
        userIdsToDelete.forEach(uid => {
          newMap.delete(uid);
          for (const [key, val] of newMap) {
            if (val.original_user_id === uid) {
              newMap.delete(key);
            }
          }
        });
        return newMap;
      });
      setSelectedUsers(new Set());
    } catch (error: any) {
      console.error('Error bulk deleting users:', error);
      toast.error("Failed to delete users: " + error.message);
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
      setConfirmText("");
    }
  };

  const toggleUserSelection = (userId: string, userEmail: string) => {
    if (userEmail === OWNER_EMAIL) {
      toast.error("Owner account cannot be selected for deletion");
      return;
    }
    
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const selectAllUsers = () => {
    const selectableUsers = filteredUsers.filter(u => u.email !== OWNER_EMAIL);
    if (selectedUsers.size === selectableUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(selectableUsers.map(u => u.id)));
    }
  };

  const toggleExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'long' });
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google': return '🌐';
      case 'github': return '🐙';
      case 'facebook': return '📘';
      case 'twitter': return '🐦';
      case 'email': return '📧';
      default: return '🔐';
    }
  };

  const getOriginalUserEmail = (originalUserId: string) => {
    const originalUser = users.find(u => u.id === originalUserId);
    return originalUser?.email || 'Unknown';
  };

  const fetchAutoBanSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'duplicate_auto_ban')
        .maybeSingle();
      if (!error && data) {
        setAutoBanEnabled(data.setting_value === 'true');
      }
    } catch (e) {
      console.error('Error fetching auto-ban setting:', e);
    }
  };

  const fetchScreenBlockSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'duplicate_screen_block')
        .maybeSingle();
      if (!error && data) {
        setScreenBlockEnabled(data.setting_value === 'true');
      }
    } catch (e) {
      console.error('Error fetching screen block setting:', e);
    }
  };

  const toggleAutoBan = async (enabled: boolean) => {
    setAutoBanLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-auth-users', {
        body: { action: 'toggle-auto-ban', enabled }
      });

      if (error) throw error;

      setAutoBanEnabled(enabled);
      toast.success(`Auto Ban ${enabled ? 'enabled' : 'disabled'} for future duplicates`);
    } catch (e: any) {
      toast.error('Failed to update setting: ' + e.message);
    } finally {
      setAutoBanLoading(false);
    }
  };

  const toggleScreenBlock = async (enabled: boolean) => {
    setScreenBlockLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-auth-users', {
        body: { action: 'toggle-screen-block', enabled }
      });

      if (error) throw error;

      setScreenBlockEnabled(enabled);
      toast.success(`Screen Block ${enabled ? 'enabled' : 'disabled'} for duplicates`);
    } catch (e: any) {
      toast.error('Failed to update setting: ' + e.message);
    } finally {
      setScreenBlockLoading(false);
    }
  };

  const fetchAutoDeleteSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'duplicate_auto_delete')
        .maybeSingle();
      if (!error && data) {
        setAutoDeleteEnabled(data.setting_value === 'true');
      }
    } catch (e) {
      console.error('Error fetching auto-delete setting:', e);
    }
  };

  const performToggleAutoDelete = async (enabled: boolean) => {
    setAutoDeleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-auth-users', {
        body: { action: 'toggle-auto-delete', enabled }
      });
      if (error) throw error;
      setAutoDeleteEnabled(enabled);
      const msg = (data as any)?.message || `Auto Delete ${enabled ? 'enabled' : 'disabled'}`;
      toast.success(msg);
      if (enabled) {
        // refresh user list after sweep
        await fetchAuthUsers();
      }
    } catch (e: any) {
      toast.error('Failed to update setting: ' + e.message);
    } finally {
      setAutoDeleteLoading(false);
    }
  };

  const toggleAutoDelete = (enabled: boolean) => {
    if (enabled) {
      // Confirm before enabling — sweep deletes existing duplicates
      setAutoDeleteConfirmOpen(true);
    } else {
      performToggleAutoDelete(false);
    }
  };

  const handleRemoveDuplicate = async (user: AuthUser) => {
    setRemovingDuplicate(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-auth-users', {
        body: { 
          action: 'remove-duplicate',
          userId: user.id
        }
      });

      if (error) throw error;

      toast.success(`Duplicate flag removed for ${user.email}`);
      // Remove from local state
      setBlockedAccountsMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(user.id);
        return newMap;
      });
      // If auto-ban was ON, the user was also unbanned
      if (autoBanEnabled) {
        setUsers(prev => prev.map(u => 
          u.id === user.id ? { ...u, banned_until: null } : u
        ));
      }
    } catch (e: any) {
      toast.error('Failed to remove duplicate: ' + e.message);
    } finally {
      setRemovingDuplicate(null);
    }
  };

  const selectableCount = filteredUsers.filter(u => u.email !== OWNER_EMAIL).length;
  const bannedCount = users.filter(u => u.banned_until).length;
  const userIds = new Set(users.map(u => u.id));
  const duplicateCount = Array.from(blockedAccountsMap.keys()).filter(id => userIds.has(id)).length;

  // Build reverse map: original_user_id -> array of duplicate BlockedAccountRows
  const originalToDuplicatesMap = new Map<string, BlockedAccountRow[]>();
  blockedAccountsMap.forEach((blocked) => {
    const existing = originalToDuplicatesMap.get(blocked.original_user_id) || [];
    existing.push(blocked);
    originalToDuplicatesMap.set(blocked.original_user_id, existing);
  });

  // Group and sort: original accounts first, then their duplicates right below
  const groupedUsers = (() => {
    const result: Array<{ user: AuthUser; isGroupedDuplicate: boolean }> = [];
    const addedIds = new Set<string>();

    // First pass: find originals and their duplicates
    filteredUsers.forEach((user) => {
      if (addedIds.has(user.id)) return;
      
      const hasDuplicates = originalToDuplicatesMap.has(user.id);
      const isDuplicate = blockedAccountsMap.has(user.id);
      
      // If this user is a duplicate, skip for now (will be added after its original)
      if (isDuplicate) return;
      
      // Add the user (original or normal)
      result.push({ user, isGroupedDuplicate: false });
      addedIds.add(user.id);
      
      // If this user has duplicates, add them right below
      if (hasDuplicates) {
        const dupes = originalToDuplicatesMap.get(user.id) || [];
        dupes.forEach((blocked) => {
          const dupeUser = filteredUsers.find(u => u.id === blocked.user_id);
          if (dupeUser && !addedIds.has(dupeUser.id)) {
            result.push({ user: dupeUser, isGroupedDuplicate: true });
            addedIds.add(dupeUser.id);
          }
        });
      }
    });

    // Second pass: add remaining duplicates whose original is not in filtered list
    filteredUsers.forEach((user) => {
      if (!addedIds.has(user.id)) {
        result.push({ user, isGroupedDuplicate: false });
        addedIds.add(user.id);
      }
    });

    return result;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/owner-portal')}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                 <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                  <Shield className="h-5 w-5 text-purple-600" />
                  Auth Users Management
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Full Supabase Authentication User Control
                </p>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Total</p>
                <p className="text-xl font-bold text-blue-800">{users.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Verified</p>
                <p className="text-xl font-bold text-green-800">
                  {users.filter(u => u.email_confirmed_at).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs text-amber-600 font-medium">Unverified</p>
                <p className="text-xl font-bold text-amber-800">
                  {users.filter(u => !u.email_confirmed_at).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border border-red-200">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xs text-red-600 font-medium">Banned</p>
                <p className="text-xl font-bold text-red-800">{bannedCount}</p>
              </div>
            </div>
          </div>

          {/* Duplicate Accounts Stats Card */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
            <div className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-orange-600 font-medium">Duplicates</p>
                <p className="text-xl font-bold text-orange-800">{duplicateCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Selected</p>
                <p className="text-xl font-bold text-purple-800">{selectedUsers.size}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auto Ban & Screen Block Toggles */}
        <div className="bg-white rounded-lg border p-3 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Auto Ban Duplicates</p>
                <p className="text-[10px] text-muted-foreground">
                  {autoBanEnabled ? 'ON: Duplicates are banned in Auth' : 'OFF: Duplicates are NOT banned in Auth'}
                </p>
              </div>
            </div>
            <Switch
              checked={autoBanEnabled}
              onCheckedChange={toggleAutoBan}
              disabled={autoBanLoading}
            />
          </div>
          <div className="border-t" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Screen Block Duplicates</p>
                <p className="text-[10px] text-muted-foreground">
                  {screenBlockEnabled ? 'ON: Duplicates see blocked screen' : 'OFF: Duplicates can use app normally'}
                </p>
              </div>
            </div>
            <Switch
              checked={screenBlockEnabled}
              onCheckedChange={toggleScreenBlock}
              disabled={screenBlockLoading}
            />
          </div>
          <div className="border-t" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-rose-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Auto Delete Duplicates</p>
                <p className="text-[10px] text-muted-foreground">
                  {autoDeleteEnabled
                    ? 'ON: Duplicates auto-deleted from Auth + profiles'
                    : 'OFF: Duplicates kept (use block/ban instead)'}
                </p>
              </div>
            </div>
            <Switch
              checked={autoDeleteEnabled}
              onCheckedChange={toggleAutoDelete}
              disabled={autoDeleteLoading}
            />
          </div>
        </div>

        {/* Search & Actions */}
        <div className="bg-white rounded-lg border p-3 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search by email, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllUsers}
                className="flex-1 sm:flex-none"
              >
                {selectedUsers.size === selectableCount && selectableCount > 0 ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedUsers.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="flex-1 sm:flex-none"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedUsers.size})
                </Button>
              )}
            </div>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2 mt-3">
            {([
              { key: 'all', label: 'All', color: 'bg-blue-100 text-blue-700 border-blue-300' },
              { key: 'original', label: 'Original', color: 'bg-green-100 text-green-700 border-green-300' },
              { key: 'duplicate', label: 'Duplicate', color: 'bg-orange-100 text-orange-700 border-orange-300' },
              { key: 'banned', label: 'Banned', color: 'bg-red-100 text-red-700 border-red-300' },
            ] as const).map(tab => (
              <Button
                key={tab.key}
                variant="outline"
                size="sm"
                onClick={() => setFilterTab(tab.key)}
                className={`flex-1 text-xs font-semibold border ${
                  filterTab === tab.key 
                    ? `${tab.color} ring-2 ring-offset-1 ring-current` 
                    : 'bg-white text-muted-foreground'
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-3 border-b bg-slate-50 rounded-t-lg">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Auth Users ({filteredUsers.length})
            </h2>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="divide-y">
              {groupedUsers.map(({ user, isGroupedDuplicate }) => {
                const isOwner = user.email === OWNER_EMAIL;
                const isSelected = selectedUsers.has(user.id);
                const isExpanded = expandedUsers.has(user.id);
                const isBanned = !!user.banned_until;
                const isDuplicate = blockedAccountsMap.has(user.id);
                const blockedData = blockedAccountsMap.get(user.id);
                const isOriginal = originalToDuplicatesMap.has(user.id);
                const duplicatesOfThis = originalToDuplicatesMap.get(user.id) || [];
                
                return (
                  <div key={user.id}>
                    <div
                      className={`p-3 flex flex-col gap-2 transition-colors ${
                        isSelected ? 'bg-purple-50' : ''
                      } ${isOwner ? 'bg-green-50' : ''} ${isBanned ? 'bg-red-50' : ''} ${isDuplicate && !isSelected && !isOwner && !isBanned ? 'bg-orange-50/50' : ''} ${isGroupedDuplicate ? 'pl-8 border-l-4 border-l-orange-300' : ''}`}
                    >
                      {/* Grouped duplicate indicator */}
                      {isGroupedDuplicate && (
                        <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium -mb-1">
                          <Copy className="h-3 w-3" />
                          <span>Duplicate of above original account</span>
                        </div>
                      )}
                      {/* Top Row: Checkbox + Avatar + Name + Badges */}
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleUserSelection(user.id, user.email || '')}
                          disabled={isOwner}
                          className="shrink-0"
                        />
                        
                        <Avatar className="h-10 w-10 shrink-0">
                          <SafeAvatarImage src={getAuthUserAvatar(user)} />
                          <AvatarFallback className="bg-purple-100 text-purple-700 font-medium">
                            {user.email?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col">
                            {user.full_name && (
                              <p className="font-semibold text-slate-800 text-sm">{user.full_name}</p>
                            )}
                            <p className={`text-xs ${user.full_name ? 'text-muted-foreground' : 'font-medium text-slate-800'} break-all`}>
                              {user.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {isOwner && (
                              <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">
                                OWNER
                              </Badge>
                            )}
                            {isBanned && (
                              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">
                                BANNED
                              </Badge>
                            )}
                            {user.email_confirmed_at ? (
                              <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] px-1.5 py-0">
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
                                Unverified
                              </Badge>
                            )}
                            {/* Original Account Badge */}
                            {isOriginal && !isDuplicate && (
                              <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">
                                Original ({duplicatesOfThis.length})
                              </Badge>
                            )}
                            {user.factors?.length > 0 && (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] px-1.5 py-0">
                                MFA
                              </Badge>
                            )}
                             {/* Duplicate Account Badge */}
                            {isDuplicate && (
                              <div className="flex items-center gap-0.5">
                                <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0 animate-pulse">
                                  Duplicate Account
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-orange-600 hover:bg-orange-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDuplicateSheetUser(user);
                                  }}
                                  title="View Duplicate Details"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1 text-green-600 hover:bg-green-100 text-[10px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDuplicate(user);
                                  }}
                                  disabled={removingDuplicate === user.id}
                                  title="Remove Duplicate Flag"
                                >
                                  {removingDuplicate === user.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <UserX className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Bottom Row: Action Icons + Date/Time */}
                      <div className="flex items-center justify-between pl-[52px]">
                        <div className="flex items-center gap-1">
                          {!isOwner && (
                            <>
                              <Button
                                variant={isBanned ? "outline" : "ghost"}
                                size="sm"
                                onClick={() => handleBanUser(user)}
                                disabled={banningUser === user.id}
                                className={`h-8 w-8 p-0 ${isBanned ? "text-green-600 border-green-300 hover:bg-green-50" : "text-amber-600 hover:bg-amber-50"}`}
                                title={isBanned ? "Unban User" : "Ban User"}
                              >
                                {banningUser === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isBanned ? (
                                  <Unlock className="h-4 w-4" />
                                ) : (
                                  <Ban className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          
                          {/* Details Sheet */}
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50" title="View Details">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                              <SheetHeader className="text-left pb-4 border-b">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-14 w-14">
                                    <SafeAvatarImage src={getAuthUserAvatar(user)} />
                                    <AvatarFallback className="bg-purple-100 text-purple-700 font-semibold text-lg">
                                      {user.email?.charAt(0).toUpperCase() || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <SheetTitle className="text-lg">{user.full_name || user.email}</SheetTitle>
                                    <SheetDescription className="text-sm">{user.email}</SheetDescription>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {isOwner && <Badge className="bg-green-500 text-white">OWNER</Badge>}
                                  {isBanned && <Badge className="bg-red-500 text-white">BANNED</Badge>}
                                  {user.email_confirmed_at ? (
                                    <Badge variant="outline" className="text-green-600 border-green-300">Verified</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-600 border-amber-300">Unverified</Badge>
                                  )}
                                  {isOriginal && !isDuplicate && (
                                    <Badge className="bg-blue-600 text-white">Original ({duplicatesOfThis.length})</Badge>
                                  )}
                                  {user.factors?.length > 0 && (
                                    <Badge variant="outline" className="text-blue-600 border-blue-300">MFA Enabled</Badge>
                                  )}
                                  {isDuplicate && (
                                    <Badge className="bg-orange-500 text-white">Duplicate Account</Badge>
                                  )}
                                </div>
                              </SheetHeader>
                              
                              <div className="py-4 space-y-4">
                                {/* Duplicate Accounts List - Show for Original accounts */}
                                {isOriginal && !isDuplicate && duplicatesOfThis.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-orange-600 uppercase tracking-wide flex items-center gap-2">
                                      <Copy className="h-4 w-4" />
                                      Duplicate Accounts ({duplicatesOfThis.length})
                                    </h4>
                                    <div className="grid gap-2">
                                      {duplicatesOfThis.map((blocked) => {
                                        const dupeUser = users.find(u => u.id === blocked.user_id);
                                        return (
                                          <div key={blocked.id} className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                                            <Avatar className="h-7 w-7 shrink-0">
                                              <SafeAvatarImage src={getAuthUserAvatar(dupeUser)} />
                                              <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                                                {dupeUser?.email?.charAt(0).toUpperCase() || '?'}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                              {dupeUser?.full_name && (
                                                <p className="text-xs font-medium truncate">{dupeUser.full_name}</p>
                                              )}
                                              <p className="text-xs text-muted-foreground break-all">{dupeUser?.email || blocked.user_id}</p>
                                            </div>
                                            <Badge className="bg-orange-500 text-white text-[9px] px-1 py-0 shrink-0">Duplicate</Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Show original account info for duplicate users */}
                                {isDuplicate && blockedData && (
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-blue-600 uppercase tracking-wide flex items-center gap-2">
                                      <Shield className="h-4 w-4" />
                                      Original Account
                                    </h4>
                                    {(() => {
                                      const origUser = users.find(u => u.id === blockedData.original_user_id);
                                      return (
                                        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                          <Avatar className="h-7 w-7 shrink-0">
                                            <SafeAvatarImage src={getAuthUserAvatar(origUser)} />
                                            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                              {origUser?.email?.charAt(0).toUpperCase() || '?'}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 min-w-0">
                                            {origUser?.full_name && (
                                              <p className="text-xs font-medium truncate">{origUser.full_name}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground break-all">{origUser?.email || blockedData.original_user_id}</p>
                                          </div>
                                          <Badge className="bg-blue-600 text-white text-[9px] px-1 py-0 shrink-0">Original</Badge>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                {/* Show sibling duplicate accounts for duplicate users */}
                                {isDuplicate && blockedData && (() => {
                                  const siblingBlockedRows = originalToDuplicatesMap.get(blockedData.original_user_id) || [];
                                  const siblings = siblingBlockedRows
                                    .filter(b => b.user_id !== user.id)
                                    .map(b => users.find(u => u.id === b.user_id))
                                    .filter(Boolean);
                                  if (siblings.length === 0) return null;
                                  return (
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-sm text-orange-600 uppercase tracking-wide flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Other Duplicate Accounts ({siblings.length})
                                      </h4>
                                      <div className="space-y-1">
                                        {siblings.map((sib: any) => (
                                          <div key={sib.id} className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                                            <Avatar className="h-7 w-7 shrink-0">
                                              <SafeAvatarImage src={getAuthUserAvatar(sib)} />
                                              <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                                                {sib?.email?.charAt(0).toUpperCase() || '?'}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                              {sib?.full_name && (
                                                <p className="text-xs font-medium truncate">{sib.full_name}</p>
                                              )}
                                              <p className="text-xs text-muted-foreground break-all">{sib?.email || sib?.id}</p>
                                            </div>
                                            <Badge className="bg-orange-500 text-white text-[9px] px-1 py-0 shrink-0">Duplicate</Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {/* Basic Info */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Info</h4>
                                  <div className="grid gap-2 text-sm">
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">ID:</span>
                                      <code className="text-xs truncate">{user.id}</code>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">Email:</span>
                                      <span className="truncate">{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">Phone:</span>
                                      <span>{user.phone || 'Not set'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">Role:</span>
                                      <span>{user.role || 'authenticated'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">Providers:</span>
                                      <span>{user.providers?.join(', ') || 'None'}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Dates */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dates</h4>
                                  <div className="grid gap-2 text-sm">
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">Created:</span>
                                      <span className="whitespace-nowrap">{formatDate(user.created_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">Last Login:</span>
                                      <span className="whitespace-nowrap">{formatDate(user.last_sign_in_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-muted-foreground">Email Verified:</span>
                                      <span className="whitespace-nowrap">{formatDate(user.email_confirmed_at)}</span>
                                    </div>
                                    {user.banned_until && (
                                      <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-red-600">
                                        <Ban className="h-4 w-4 shrink-0" />
                                        <span>Banned Until:</span>
                                        <span className="whitespace-nowrap">{formatDate(user.banned_until)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Metadata */}
                                {(Object.keys(user.user_metadata || {}).length > 0 || Object.keys(user.app_metadata || {}).length > 0) && (
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Metadata</h4>
                                    {Object.keys(user.user_metadata || {}).length > 0 && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">User Metadata:</p>
                                        <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
                                          {JSON.stringify(user.user_metadata, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {Object.keys(user.app_metadata || {}).length > 0 && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">App Metadata:</p>
                                        <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
                                          {JSON.stringify(user.app_metadata, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Actions */}
                                {!isOwner && (
                                  <div className="space-y-2 pt-4 border-t">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Actions</h4>
                                    <div className="flex gap-2">
                                      <Button
                                        variant={isBanned ? "outline" : "destructive"}
                                        size="sm"
                                        onClick={() => handleBanUser(user)}
                                        disabled={banningUser === user.id}
                                        className={isBanned ? "text-green-600 border-green-300 hover:bg-green-50 flex-1" : "flex-1"}
                                      >
                                        {banningUser === user.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : isBanned ? (
                                          <Unlock className="h-4 w-4 mr-2" />
                                        ) : (
                                          <Ban className="h-4 w-4 mr-2" />
                                        )}
                                        {isBanned ? 'Unban User' : 'Ban User'}
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDeleteUser(user)}
                                        className="flex-1"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete User
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </SheetContent>
                          </Sheet>
                          
                        </div>
                        
                        <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                          <Calendar className="h-3 w-3" />
                          {formatDate(user.created_at)}
                        </span>
                      </div>
                    </div>
                    
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Duplicate Account Detail Sheet - Mobile Friendly */}
      <Sheet open={!!duplicateSheetUser} onOpenChange={(open) => !open && setDuplicateSheetUser(null)}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto px-3 sm:px-6">
          {duplicateSheetUser && (() => {
            const blocked = blockedAccountsMap.get(duplicateSheetUser.id);
            if (!blocked) return null;
            const signals = blocked.block_signals || {};
            const originalEmail = getOriginalUserEmail(blocked.original_user_id);
            const originalUser = users.find(u => u.id === blocked.original_user_id);

            return (
              <>
                <SheetHeader className="text-left pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <AlertOctagon className="h-5 w-5 sm:h-7 sm:w-7 text-orange-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="text-base sm:text-lg text-orange-700">Duplicate Account Detected</SheetTitle>
                      <SheetDescription className="text-xs sm:text-sm break-all">{duplicateSheetUser.email}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="py-4 space-y-4">
                  {/* Duplicate User Info */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">Duplicate Account</h4>
                    <div className="grid gap-2 text-xs sm:text-sm">
                      <div className="flex items-start gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <Mail className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-[10px] block">Email</span>
                          <span className="break-all font-medium">{duplicateSheetUser.email}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <Key className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-[10px] block">User ID</span>
                          <code className="text-[10px] sm:text-xs break-all">{duplicateSheetUser.id}</code>
                        </div>
                      </div>
                      {duplicateSheetUser.full_name && (
                        <div className="flex items-start gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                          <Users className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-muted-foreground text-[10px] block">Name</span>
                            <span className="break-all font-medium">{duplicateSheetUser.full_name}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <Calendar className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-[10px] block">Created</span>
                          <span>{formatDate(duplicateSheetUser.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Original Account Info */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">Original Account</h4>
                    <div className="grid gap-2 text-xs sm:text-sm">
                      <div className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
                        <Mail className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-[10px] block">Email</span>
                          <span className="break-all font-medium">{originalEmail}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
                        <Key className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-[10px] block">User ID</span>
                          <code className="text-[10px] sm:text-xs break-all">{blocked.original_user_id}</code>
                        </div>
                      </div>
                      {originalUser?.full_name && (
                        <div className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
                          <Users className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-muted-foreground text-[10px] block">Name</span>
                            <span className="break-all font-medium">{originalUser.full_name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Block Reason</h4>
                    <div className="p-3 bg-red-50 rounded border border-red-200 text-sm">
                      <p>{blocked.reason || 'No reason provided'}</p>
                    </div>
                  </div>

                  {/* Block Signals */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">Matched Signals</h4>
                    <div className="grid gap-2 text-xs sm:text-sm">
                      {blocked.device_id && (
                        <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                          <Monitor className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-muted-foreground text-[10px] block">Device ID</span>
                            <code className="text-[10px] sm:text-xs break-all">{blocked.device_id}</code>
                          </div>
                        </div>
                      )}
                      {blocked.fingerprint_hash && (
                        <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                          <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-muted-foreground text-[10px] block">Fingerprint</span>
                            <code className="text-[10px] sm:text-xs break-all">{blocked.fingerprint_hash}</code>
                          </div>
                        </div>
                      )}
                      {blocked.canvas_fingerprint && (
                        <div className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                          <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-muted-foreground text-[10px] block">Canvas</span>
                            <code className="text-[10px] sm:text-xs break-all">{blocked.canvas_fingerprint}</code>
                          </div>
                        </div>
                      )}
                      {signals.matched_device_id && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-amber-700 font-medium">Device ID Match</span>
                        </div>
                      )}
                      {signals.matched_fingerprint && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-amber-700 font-medium">Browser Fingerprint Match</span>
                        </div>
                      )}
                      {signals.matched_canvas && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-amber-700 font-medium">Canvas Fingerprint Match</span>
                        </div>
                      )}
                      {signals.matched_ip && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-amber-700 font-medium">IP Address Match</span>
                        </div>
                      )}
                      {signals.matched_audio && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-amber-700 font-medium">Audio Fingerprint Match</span>
                        </div>
                      )}
                      {signals.confidence_score != null && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="font-bold">{Number(signals.confidence_score).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">Block Date</h4>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs sm:text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Blocked At:</span>
                      <span>{formatDate(blocked.created_at)}</span>
                    </div>
                  </div>

                  {/* Raw Block Signals */}
                  {Object.keys(signals).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">Raw Block Signals</h4>
                      <pre className="text-[10px] sm:text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                        {JSON.stringify(signals, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Single Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete User?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.email}</strong>? 
              This action cannot be undone and will remove the user from Supabase Auth.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deleting}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete {selectedUsers.size} Users?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete <strong>{selectedUsers.size}</strong> selected users 
                from Supabase Auth. This action cannot be undone.
              </p>
              <p>Type <strong>DELETE</strong> to confirm:</p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto" onClick={() => setConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={deleting || confirmText !== "DELETE"}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Selected
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto Delete Enable Confirmation */}
      <AlertDialog open={autoDeleteConfirmOpen} onOpenChange={setAutoDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <UserX className="h-5 w-5" /> Enable Auto Delete Duplicates?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>all existing duplicate accounts</strong> (Auth user + job seeker profile + employer profile) and any future duplicates detected. No email is sent for auto-deletes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={autoDeleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              disabled={autoDeleteLoading}
              onClick={async (e) => {
                e.preventDefault();
                await performToggleAutoDelete(true);
                setAutoDeleteConfirmOpen(false);
              }}
            >
              {autoDeleteLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</>
              ) : (
                'Enable & Delete Duplicates'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
