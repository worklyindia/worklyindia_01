import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTeamManagement, TeamMember } from "@/hooks/useTeamManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamMemberCard } from "@/components/team/TeamMemberCard";
import { PermissionEditor } from "@/components/team/PermissionEditor";
import { ConfirmationDialog } from "@/components/team/ConfirmationDialog";
import { AuditLogTimeline } from "@/components/team/AuditLogTimeline";
import { TeamMemberSkeleton } from "@/components/team/TeamMemberSkeleton";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RoleChangeDialog } from "@/components/team/RoleChangeDialog";
import { BulkActionsBar } from "@/components/team/BulkActionsBar";
import { ActivityDashboard } from "@/components/team/ActivityDashboard";
import { ExportLogsDialog } from "@/components/team/ExportLogsDialog";
import { PermissionMatrixView } from "@/components/team/PermissionMatrixView";
import { AdvancedTeamFilters } from "@/components/team/AdvancedTeamFilters";
import { BulkRoleChangeDialog } from "@/components/team/BulkRoleChangeDialog";
import { RoleHierarchyChart } from "@/components/team/RoleHierarchyChart";
import { CustomRoleList } from "@/components/team/CustomRoleList";
import { Users, UserPlus, Shield, FileText, Download, AlertCircle, RefreshCw, Plus } from "lucide-react";

export default function TeamManagement() {
  const navigate = useNavigate();
  const {
    teamMembers,
    auditLogs,
    teamRoles,
    loading,
    error,
    fetchTeamMembers,
    fetchAuditLogs,
    fetchTeamRoles,
    updatePermissions,
    removeMember,
    changeRole,
    bulkUpdatePermissions,
    exportAuditLogs,
    deleteCustomRole,
  } = useTeamManagement();

  const { isSuperAdmin } = usePermissions();
  const [isSuper, setIsSuper] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [showPermissionEditor, setShowPermissionEditor] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showRoleChangeDialog, setShowRoleChangeDialog] = useState(false);
  const [showBulkPermissionEditor, setShowBulkPermissionEditor] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showBulkRoleChangeDialog, setShowBulkRoleChangeDialog] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [lastActiveFilter, setLastActiveFilter] = useState("all");
  const [permissionFilter, setPermissionFilter] = useState("all");

  useEffect(() => {
    const checkAdmin = async () => {
      const result = await isSuperAdmin();
      setIsSuper(result);
    };
    checkAdmin();
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchTeamMembers();
    fetchAuditLogs();
    fetchTeamRoles();
  }, [fetchTeamMembers, fetchAuditLogs, fetchTeamRoles]);

  const handleEditPermissions = (member: TeamMember) => {
    setSelectedMemberId(member.user_id);
    setShowPermissionEditor(true);
  };

  const handleRemoveClick = (member: TeamMember) => {
    setMemberToRemove(member);
    setShowRemoveDialog(true);
  };

  const handleRemoveConfirm = async () => {
    if (memberToRemove) {
      await removeMember(memberToRemove.user_id);
      setMemberToRemove(null);
    }
  };

  const handleRoleChange = (member: TeamMember) => {
    setSelectedMemberId(member.user_id);
    setShowRoleChangeDialog(true);
  };

  const handleRoleChangeSave = async (userId: string, newRole: string, preservePermissions: boolean) => {
    await changeRole(userId, newRole, preservePermissions);
    setShowRoleChangeDialog(false);
    setSelectedMemberId(null);
  };

  const handleSelectToggle = (memberId: string) => {
    const newSelected = new Set(selectedMemberIds);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMemberIds(newSelected);
  };

  const handleBulkPermissions = () => {
    if (selectedMemberIds.size > 0) {
      setShowBulkPermissionEditor(true);
    }
  };

  const handleBulkPermissionsSave = async (permissions: any) => {
    await bulkUpdatePermissions(Array.from(selectedMemberIds), permissions);
    setSelectedMemberIds(new Set());
    setShowBulkPermissionEditor(false);
  };

  const handleBulkRemove = () => {
    if (selectedMemberIds.size > 0) {
      setShowRemoveDialog(true);
    }
  };

  const handleBulkRemoveConfirm = async () => {
    for (const memberId of selectedMemberIds) {
      await removeMember(memberId);
    }
    setSelectedMemberIds(new Set());
    setShowRemoveDialog(false);
  };

  const handleBulkRoleChange = () => {
    if (selectedMemberIds.size > 0) {
      setShowBulkRoleChangeDialog(true);
    }
  };

  const handleBulkRoleChangeSave = async (newRole: string, preservePermissions: boolean) => {
    for (const memberId of selectedMemberIds) {
      await changeRole(memberId, newRole, preservePermissions);
    }
    setSelectedMemberIds(new Set());
    setShowBulkRoleChangeDialog(false);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setLastActiveFilter("all");
    setPermissionFilter("all");
  };

  const checkLastActive = (lastSignIn: string, filter: string): boolean => {
    if (filter === "all") return true;
    
    const lastSignInDate = new Date(lastSignIn);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastSignInDate.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (filter) {
      case "today": return daysDiff === 0;
      case "week": return daysDiff <= 7;
      case "month": return daysDiff <= 30;
      case "inactive": return daysDiff > 30;
      default: return true;
    }
  };

  const checkHasPermission = (member: any, filter: string): boolean => {
    if (filter === "all") return true;
    
    const [category, action] = filter.split('.');
    return member.permissions?.[category]?.[action] === true;
  };

  // Get the current member from the latest teamMembers array by ID
  const selectedMember = useMemo(() => {
    if (!selectedMemberId) return null;
    return teamMembers.find(m => m.user_id === selectedMemberId) || null;
  }, [selectedMemberId, teamMembers]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      const matchesSearch = 
        member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesLastActive = checkLastActive(member.last_sign_in_at, lastActiveFilter);
      const matchesPermission = checkHasPermission(member, permissionFilter);
      
      return matchesSearch && matchesRole && matchesLastActive && matchesPermission;
    });
  }, [teamMembers, searchQuery, roleFilter, lastActiveFilter, permissionFilter]);

  const memberCountsByRole = useMemo(() => {
    return teamMembers.reduce((acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [teamMembers]);

  if (loading && teamMembers.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error && teamMembers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to Load Team Data</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={fetchTeamMembers} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Team & Role Management
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
              Manage your team members, roles, and permissions
            </p>
          </div>

          {isSuper && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button 
                onClick={() => navigate('/owner-portal/invite-member')} 
                className="w-full sm:w-auto min-h-[48px] text-base"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                <span>Invite Member</span>
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/owner-portal/create-role')}
                  className="flex-1 sm:flex-initial min-h-[48px]"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Create Role</span>
                  <span className="sm:hidden">Role</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowExportDialog(true)}
                  className="flex-1 sm:flex-initial min-h-[48px]"
                >
                  <Download className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Export Logs</span>
                  <span className="sm:hidden">Export</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Stats and Activity */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/20 p-2.5 rounded-lg shrink-0">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground truncate">Members</p>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 dark:bg-purple-900/20 p-2.5 rounded-lg shrink-0">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground truncate">Roles</p>
                <p className="text-2xl font-bold">
                  {teamRoles.filter(r => r.is_custom).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/20 p-2.5 rounded-lg shrink-0">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground truncate">Audit Logs</p>
                <p className="text-2xl font-bold">{auditLogs.length}</p>
              </div>
            </div>
          </Card>

          <ActivityDashboard recentLogs={auditLogs} loading={loading} error={error} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="members" className="text-sm px-3 py-3.5 min-h-[48px] data-[state=active]:bg-background">
              <span className="hidden sm:inline">Team Members</span>
              <span className="sm:hidden">Members</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-sm px-3 py-3.5 min-h-[48px] data-[state=active]:bg-background">
              Roles
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-sm px-3 py-3.5 min-h-[48px] data-[state=active]:bg-background">
              <span className="hidden sm:inline">Audit Log</span>
              <span className="sm:hidden">Audit</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <AdvancedTeamFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              roleFilter={roleFilter}
              onRoleFilterChange={setRoleFilter}
              lastActiveFilter={lastActiveFilter}
              onLastActiveFilterChange={setLastActiveFilter}
              permissionFilter={permissionFilter}
              onPermissionFilterChange={setPermissionFilter}
              roles={teamRoles}
              onClearFilters={handleClearFilters}
            />

            {loading && teamMembers.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <TeamMemberSkeleton key={i} />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {teamMembers.length === 0 ? "No team members yet" : "No members match your filters"}
                </p>
                {isSuper && teamMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Invite Member" to add your first team member
                  </p>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMembers.map((member) => (
                  <TeamMemberCard
                    key={member.user_id}
                    member={member}
                    onEdit={handleEditPermissions}
                    onRemove={handleRemoveClick}
                    onChangeRole={handleRoleChange}
                    isSuperAdmin={isSuper}
                    isSelected={selectedMemberIds.has(member.user_id)}
                    onSelectToggle={handleSelectToggle}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <RoleHierarchyChart roles={teamRoles} memberCounts={memberCountsByRole} />
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Custom Roles</h3>
                  <CustomRoleList 
                    roles={teamRoles} 
                    memberCounts={memberCountsByRole}
                    onDelete={deleteCustomRole}
                  />
                </Card>
              </div>
              <PermissionMatrixView roles={teamRoles} />
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogTimeline logs={auditLogs} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <PermissionEditor
        member={selectedMember}
        open={showPermissionEditor}
        onClose={() => {
          setShowPermissionEditor(false);
          setSelectedMemberId(null);
        }}
        onSave={updatePermissions}
      />

      <RoleChangeDialog
        member={selectedMember}
        open={showRoleChangeDialog}
        onClose={() => {
          setShowRoleChangeDialog(false);
          setSelectedMemberId(null);
        }}
        onSave={handleRoleChangeSave}
        roles={teamRoles}
      />

      <PermissionEditor
        member={
          showBulkPermissionEditor
            ? (() => {
                const selected = teamMembers.filter(m => selectedMemberIds.has(m.user_id));
                if (selected.length === 1) {
                  return selected[0] as TeamMember;
                }
                return {
                  user_id: "bulk",
                  email: "bulk",
                  full_name: `${selectedMemberIds.size} members`,
                  role: "bulk",
                  permissions: {},
                  last_sign_in_at: "",
                  created_at: ""
                } as TeamMember;
              })()
            : null
        }
        open={showBulkPermissionEditor}
        onClose={() => setShowBulkPermissionEditor(false)}
        onSave={async (_, permissions) => {
          await handleBulkPermissionsSave(permissions);
        }}
      />

      <ExportLogsDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={exportAuditLogs}
      />

      <ConfirmationDialog
        open={showRemoveDialog}
        onClose={() => {
          setShowRemoveDialog(false);
          setMemberToRemove(null);
        }}
        onConfirm={selectedMemberIds.size > 0 ? handleBulkRemoveConfirm : handleRemoveConfirm}
        title={selectedMemberIds.size > 0 ? "Remove Multiple Members" : "Remove Team Member"}
        description={
          selectedMemberIds.size > 0
            ? `Are you sure you want to remove ${selectedMemberIds.size} team members? This action cannot be undone.`
            : `Are you sure you want to remove ${memberToRemove?.full_name || memberToRemove?.email} from the team? This action cannot be undone.`
        }
        confirmText="Remove"
        requireTyping={true}
        typingConfirmText="CONFIRM"
      />

      <BulkRoleChangeDialog
        open={showBulkRoleChangeDialog}
        onClose={() => setShowBulkRoleChangeDialog(false)}
        onSave={handleBulkRoleChangeSave}
        roles={teamRoles}
        selectedMembers={teamMembers.filter(m => selectedMemberIds.has(m.user_id))}
      />

      <BulkActionsBar
        selectedCount={selectedMemberIds.size}
        onClear={() => setSelectedMemberIds(new Set())}
        onBulkPermissions={handleBulkPermissions}
        onBulkRemove={handleBulkRemove}
        onBulkRoleChange={handleBulkRoleChange}
      />
    </div>
  );
}
