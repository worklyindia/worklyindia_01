import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyAccountDeleted } from "@/lib/accountStatusNotify";
import { Search, Users, MapPin, Briefcase, Activity, User, Calendar, Shield, Filter, UserCheck, Ban, Trash2, Download, FileSpreadsheet, Table, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWebsiteUsersManagement } from "@/hooks/useWebsiteUsersManagement";
import WebsiteUserCard from "@/components/owner-portal/WebsiteUserCard";
import { WebsiteUserEditDialog } from "@/components/owner-portal/WebsiteUserEditDialog";
import { WebsiteUserProfileDialog } from "@/components/owner-portal/WebsiteUserProfileDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useSupabaseDownload } from "@/hooks/useSupabaseDownload";
import { format } from "date-fns";
import { toast } from "sonner";
import LottieSearchIcon from "@/components/LottieSearchIcon";

export default function WebsiteUsersManagement() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  
  const isMobile = useIsMobile();
  const { scrollDirection, scrollY } = useScrollDirection();
  const { user } = useAuth();

  // Verify admin status before allowing access
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setAdminVerified(false);
        setAdminChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('check_admin_role', {
          target_user_id: user.id,
          required_role: 'admin'
        });

        if (error) {
          console.log('Admin check error:', error);
          setAdminVerified(false);
        } else {
          setAdminVerified(data === true);
        }
      } catch (err) {
        console.error('Admin verification error:', err);
        setAdminVerified(false);
      }
      
      setAdminChecking(false);
    };

    checkAdminStatus();
  }, [user]);

  const {
    users,
    loading,
    error,
    totalCount,
    filters,
    setFilters,
    availableLocations,
    availableIndustries,
    updateUserProfile,
    updateUserStatus,
    refreshData
  } = useWebsiteUsersManagement(adminVerified);

  const handleEditUser = async (updatedUser: any) => {
    try {
      await updateUserProfile(updatedUser.user_id, updatedUser);
      toast.success(`${updatedUser.full_name} profile updated successfully`);
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Edit failed:', error);
      toast.error(`Failed to update ${updatedUser.full_name} profile`);
      throw error;
    }
  };

  const openDeleteDialog = (userId: string, userName: string) => {
    setUserToDelete({ id: userId, name: userName });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeleting(true);
    try {
      // Capture the contact BEFORE the profile row is removed, so the
      // "profile deleted" Email / Telegram template can still reach the user.
      const { data: contact } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', userToDelete.id)
        .maybeSingle();

      // Use admin_delete_website_user_data - deletes profile only, keeps account
      const { data, error } = await supabase.rpc('admin_delete_website_user_data', {
        target_user_id: userToDelete.id
      });
      
      if (error) {
        throw error;
      }
      
      // Check if the function returned success: false
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error((data as any).error || 'Failed to delete user data');
      }
      
      void notifyAccountDeleted({
        userId: userToDelete.id,
        audience: 'job_seeker',
        name: contact?.full_name || userToDelete.name,
        email: contact?.email,
      });

      toast.success(`${userToDelete.name} profile data deleted successfully (account remains active)`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      refreshData();
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast.error(`Failed to delete ${userToDelete.name} profile data: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const fetchUserProfileData = async (userId: string) => {
    setLoadingProfile(true);
    try {
      // Fetch education entries
      const { data: educationData } = await supabase
        .from('education_entries')
        .select('*')
        .eq('user_id', userId)
        .order('end_year', { ascending: false });

      // Fetch certifications
      const { data: certificationsData } = await supabase
        .from('certifications')
        .select('*')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false });

      // Fetch professional experiences
      const { data: experiencesData } = await supabase
        .from('professional_experiences')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      return {
        educationEntries: educationData || [],
        certifications: certificationsData || [],
        professionalExperiences: experiencesData || []
      };
    } catch (error) {
      console.error('Error fetching profile data:', error);
      return {
        educationEntries: [],
        certifications: [],
        professionalExperiences: []
      };
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleViewUser = async (user: any) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
    
    // Fetch additional profile data
    const additionalData = await fetchUserProfileData(user.user_id);
    setProfileData(additionalData);
  };

  const [quickFilter, setQuickFilter] = useState<string>('all');

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? "" : value
    }));
  };

  // Apply quick filter on top of existing data
  const getFilteredUsers = () => {
    if (!users) return [];
    switch (quickFilter) {
      case 'complete':
        return users.filter(u => !!(u.full_name?.trim() && u.phone?.trim()));
      case 'incomplete':
        return users.filter(u => !(u.full_name?.trim() && u.phone?.trim()));
      case 'new':
        return users.filter(u => {
          if (!u.created_at) return false;
          const daysSince = Math.floor((Date.now() - new Date(u.created_at).getTime()) / (1000 * 3600 * 24));
          return daysSince <= 7;
        });
      case 'banned':
        return users.filter(u => u.account_status === 'banned' || u.account_status === 'job_banned' || u.account_status === 'fully_banned');
      default:
        return users;
    }
  };

  const filteredUsers = getFilteredUsers();

  const { downloadCSV, downloadJSON, downloadPDF, isDownloading } = useSupabaseDownload();

  // Export functions
  const exportAsPDF = async () => {
    if (!users || users.length === 0) {
      toast.error("No users to export");
      return;
    }

    const pdfData = users.map(u => ({
      Name: u.full_name || '-',
      Email: u.email || '-',
      Phone: u.phone || '-',
      Location: u.location || '-',
      Industry: u.industry || '-',
      Skills: (u.skills || []).slice(0, 3).join(', ') || '-',
      Status: u.account_status || 'active',
      Joined: u.created_at ? format(new Date(u.created_at), 'dd MMMM yyyy') : '-'
    }));

    await downloadPDF(`website_users_${format(new Date(), 'yyyy-MM-dd')}`, pdfData, 'Website Users Export');
    toast.success(`Exported ${users.length} users to PDF`);
  };

  const exportAsCSV = async () => {
    if (!users || users.length === 0) {
      toast.error("No users to export");
      return;
    }

    const csvData = users.map(u => ({
      Name: u.full_name || '',
      Email: u.email || '',
      Phone: u.phone || '',
      Location: u.location || '',
      Industry: u.industry || '',
      Position: u.current_position || '',
      Company: u.company || '',
      Skills: (u.skills || []).join(', '),
      Status: u.account_status || 'active',
      'Joined Date': u.created_at ? format(new Date(u.created_at), 'dd MMMM yyyy') : ''
    }));

    await downloadCSV(`website_users_${format(new Date(), 'yyyy-MM-dd')}`, csvData);
    toast.success(`Exported ${users.length} users to CSV`);
  };

  const exportToGoogleSheets = async () => {
    if (!users || users.length === 0) {
      toast.error("No users to export");
      return;
    }

    const loadingToast = toast.loading("Exporting to Google Sheets...");

    try {
      const usersData = users.map(u => ({
        name: u.full_name || '',
        email: u.email || '',
        phone: u.phone || '',
        position: u.current_position || '',
        company: u.company || '',
        location: u.location || '',
        skills: (u.skills || []).join(', '),
        status: u.account_status || 'active',
        appliedDate: u.created_at ? format(new Date(u.created_at), 'dd MMMM yyyy') : ''
      }));

      const { data, error } = await supabase.functions.invoke('export-to-sheets', {
        body: {
          applicants: usersData,
          jobTitle: 'Website Users Export'
        }
      });

      toast.dismiss(loadingToast);

      if (error) throw error;

      if (data?.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
        toast.success(`Exported ${users.length} users to Google Sheets!`);
      } else {
        throw new Error('No spreadsheet URL returned');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error('Google Sheets export error:', err);
      toast.error("Google Sheets export failed. Please try again.");
    }
  };

  // Show loading state while checking admin access
  if (adminChecking) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <LoadingSpinner />
            <p className="mt-4 text-muted-foreground">Verifying admin access...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show access denied if not admin
  if (!adminVerified) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You must be an admin to view website users.
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild>
                <a href="/auth">Sign In</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/">Go Home</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const isAuthError = error.includes('Authentication required') || error.includes('log in');
    const isPermError = error.includes('Admin access required') || error.includes('admin privileges');
    
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">
              {isAuthError ? 'Authentication Required' : isPermError ? 'Access Denied' : 'Error'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-2 justify-center">
              {isAuthError ? (
                <>
                  <Button asChild>
                    <a href="/auth">Sign In</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/">Go Home</a>
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/">Go Home</a>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sticky header behavior
  const headerClass = `sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b transition-transform duration-300 ${
    scrollDirection === "down" && scrollY > 100 ? "-translate-y-full" : "translate-y-0"
  }`;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className={headerClass}>
        <div className="container mx-auto p-4 sm:p-6">
          {/* Header Title and Stats */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{totalCount}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {users?.filter(u => u.account_status === 'active' && u.last_sign_in_at && Math.floor((new Date().getTime() - new Date(u.last_sign_in_at).getTime()) / (1000 * 3600 * 24)) <= 30).length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
              </div>
              
              {/* Filter and Export Icons */}
              <div className="flex items-center gap-2">
                {/* Export Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-3">
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportAsPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportAsCSV}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToGoogleSheets}>
                      <Table className="h-4 w-4 mr-2" />
                      Google Sheets
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Account Status Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2">
                    <Select value={filters.status || "all"} onValueChange={(value) => handleFilterChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="active">Active Users</SelectItem>
                        <SelectItem value="job_banned">Job Banned</SelectItem>
                        <SelectItem value="banned">Profile Banned</SelectItem>
                        <SelectItem value="fully_banned">Fully Banned (Both)</SelectItem>
                      </SelectContent>
                    </Select>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'All', count: users?.length || 0 },
              { key: 'complete', label: 'Complete', count: users?.filter(u => !!(u.full_name?.trim() && u.phone?.trim())).length || 0 },
              { key: 'incomplete', label: 'Incomplete', count: users?.filter(u => !(u.full_name?.trim() && u.phone?.trim())).length || 0 },
              { key: 'new', label: 'New', count: users?.filter(u => { if (!u.created_at) return false; return Math.floor((Date.now() - new Date(u.created_at).getTime()) / (1000 * 3600 * 24)) <= 7; }).length || 0 },
              { key: 'banned', label: 'Banned', count: users?.filter(u => u.account_status === 'banned' || u.account_status === 'job_banned' || u.account_status === 'fully_banned').length || 0 },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setQuickFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  quickFilter === tab.key 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="mt-3">
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search by name, email, phone, user ID, position, or skills..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-12 h-12 text-base rounded-xl border-2 focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4 sm:p-6 pt-0">
        {loading ? (
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted rounded-2xl h-80"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Users Grid - More mobile-friendly spacing */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredUsers?.map((user) => (
                <WebsiteUserCard
                  key={user.user_id}
                  user={user}
                  onView={handleViewUser}
                  onEdit={() => {
                    setSelectedUser(user);
                    setEditDialogOpen(true);
                  }}
                  onStatusUpdate={refreshData}
                  onDelete={() => openDeleteDialog(user.user_id, user.full_name)}
                  updateUserStatus={updateUserStatus}
                />
              ))}
            </div>

          </>
        )}
      </div>

      {/* Edit Dialog */}
      {selectedUser && (
        <WebsiteUserEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSave={handleEditUser}
          updateUserStatus={updateUserStatus}
        />
      )}

      {/* View Profile Dialog - Using WebsiteUserProfileDialog */}
      {selectedUser && profileData && (
        <WebsiteUserProfileDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          user={{
            ...selectedUser,
            educationEntries: profileData.educationEntries,
            certifications: profileData.certifications,
            professionalExperiences: profileData.professionalExperiences
          }}
        />
      )}

      {/* Loading state for profile view */}
      {viewDialogOpen && loadingProfile && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Loading Profile...</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center p-8">
              <LoadingSpinner />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Profile Data
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>'s profile data? 
              This will permanently remove their profile, education, experience, applications, and saved jobs. 
              <br /><br />
              <strong>Note:</strong> User account will remain active. Company/Employer data will NOT be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}