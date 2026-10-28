import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Building, Users, TrendingUp, Shield, ShieldCheck, Filter, MapPin, Briefcase, Activity, Download, FileSpreadsheet, Table, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEnhancedEmployerManagement } from "@/hooks/useEnhancedEmployerManagement";
import DeletedEmployerCard from "@/components/owner-portal/DeletedEmployerCard";
import EnhancedEmployerCard from "@/components/owner-portal/EnhancedEmployerCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useSupabaseDownload } from "@/hooks/useSupabaseDownload";
import { format } from "date-fns";
import { toast } from "sonner";
import { getCompanyDisplayLocation } from "@/utils/locationUtils";
import VerificationBadge from "@/components/VerificationBadge";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import LottieSearchIcon from "@/components/LottieSearchIcon";

export default function EmployerMembersManagement() {
  const [selectedEmployer, setSelectedEmployer] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  
  const isMobile = useIsMobile();
  const { scrollDirection, scrollY } = useScrollDirection();
  const { user } = useAuth();

  // Check admin status before mounting the hook
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

  const hookResult = useEnhancedEmployerManagement(adminVerified);
  
  const {
    employers,
    loading,
    error,
    totalCount,
    currentPage,
    setCurrentPage,
    filters,
    setFilters,
    availableLocations,
    availableIndustries,
    updateEmployerVerification,
    updateEmployerProfile,
    setJobPostingVisibility,
    setAccountStatus,
    updateVerificationDetails,
    refreshData,
    errorStage,
    isLimitedView,
    recoverCompany
  } = hookResult;

  const handleEditEmployer = async (updatedEmployer: any) => {
    try {
      console.log('EmployerMembersManagement: Handling edit for user:', updatedEmployer.user_id);
      await updateEmployerProfile(updatedEmployer.user_id, updatedEmployer);
      toast.success(`${updatedEmployer.company_name} profile updated successfully`);
      console.log('EmployerMembersManagement: Edit completed successfully');
    } catch (error) {
      console.error('EmployerMembersManagement: Edit failed:', error);
      toast.error(`Failed to update ${updatedEmployer.company_name} profile`);
      throw error; // Re-throw to keep dialog open
    }
  };

  const handleViewEmployer = (employer: any) => {
    setSelectedEmployer(employer);
    setViewDialogOpen(true);
  };

  const handleVerificationToggle = async (companyId: string, isVerified: boolean) => {
    try {
      await updateEmployerVerification(companyId, !isVerified, isVerified ? undefined : 'gold');
      toast.success(`Company ${!isVerified ? 'verified' : 'unverified'} successfully`);
    } catch (error) {
      toast.error(`Failed to ${!isVerified ? 'verify' : 'unverify'} company`);
    }
  };

  const [quickFilter, setQuickFilter] = useState<string>('all');

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? "" : value
    }));
    setCurrentPage(1);
  };

  // Helper: check if employer profile is complete using display location
  const isEmployerComplete = (e: any): boolean => {
    const displayLocation = getCompanyDisplayLocation(e);
    const hasLocation = !!displayLocation && displayLocation !== 'Location not provided' && displayLocation !== 'No company profile found';
    return !!(e.company_name?.trim() && e.email?.trim() && hasLocation && e.phone?.trim());
  };

  // Apply quick filter on top of existing data
  const getFilteredEmployers = () => {
    if (!employers) return [];
    
    switch (quickFilter) {
      case 'complete':
        return employers.filter(e => isEmployerComplete(e));
      case 'incomplete':
        return employers.filter(e => !isEmployerComplete(e));
      case 'new':
        return employers.filter(e => {
          if (!e.created_at) return false;
          const daysSince = Math.floor((Date.now() - new Date(e.created_at).getTime()) / (1000 * 3600 * 24));
          return daysSince <= 7;
        });
      case 'banned':
        return employers.filter(e => e.account_status === 'banned' || e.account_status === 'job_banned' || e.account_status === 'fully_banned');
      default:
        return employers;
    }
  };

  const filteredEmployers = getFilteredEmployers();

  const { downloadCSV, downloadPDF, isDownloading } = useSupabaseDownload();

  // Export functions
  const exportAsPDF = async () => {
    if (!employers || employers.length === 0) {
      toast.error("No employers to export");
      return;
    }

    const pdfData = employers.map(e => ({
      Company: e.company_name || '-',
      Email: e.email || '-',
      Phone: e.phone || '-',
      Location: e.location || '-',
      Industry: e.industry || '-',
      Verified: e.is_verified ? 'Yes' : 'No',
      Status: e.account_status || 'active',
      Jobs: e.total_jobs || 0,
      Joined: e.created_at ? format(new Date(e.created_at), 'dd MMMM yyyy') : '-'
    }));

    await downloadPDF(`employers_${format(new Date(), 'yyyy-MM-dd')}`, pdfData, 'Employers Export');
    toast.success(`Exported ${employers.length} employers to PDF`);
  };

  const exportAsCSV = async () => {
    if (!employers || employers.length === 0) {
      toast.error("No employers to export");
      return;
    }

    const csvData = employers.map(e => ({
      'Company Name': e.company_name || '',
      Email: e.email || '',
      Phone: e.phone || '',
      Location: e.location || '',
      Industry: e.industry || '',
      Verified: e.is_verified ? 'Yes' : 'No',
      Status: e.account_status || 'active',
      'Total Jobs': e.total_jobs || 0,
      'Joined Date': e.created_at ? format(new Date(e.created_at), 'dd MMMM yyyy') : ''
    }));

    await downloadCSV(`employers_${format(new Date(), 'yyyy-MM-dd')}`, csvData);
    toast.success(`Exported ${employers.length} employers to CSV`);
  };

  const exportToGoogleSheets = async () => {
    if (!employers || employers.length === 0) {
      toast.error("No employers to export");
      return;
    }

    const loadingToast = toast.loading("Exporting to Google Sheets...");

    try {
      const employersData = employers.map(e => ({
        name: e.company_name || '',
        email: e.email || '',
        phone: e.phone || '',
        position: e.industry || '',
        company: e.is_verified ? 'Verified' : 'Not Verified',
        location: e.location || '',
        skills: `Jobs: ${e.total_jobs || 0}`,
        status: e.account_status || 'active',
        appliedDate: e.created_at ? format(new Date(e.created_at), 'dd MMMM yyyy') : ''
      }));

      const { data, error } = await supabase.functions.invoke('export-to-sheets', {
        body: {
          applicants: employersData,
          jobTitle: 'Employers Export'
        }
      });

      toast.dismiss(loadingToast);

      if (error) throw error;

      if (data?.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
        toast.success(`Exported ${employers.length} employers to Google Sheets!`);
      } else {
        throw new Error('No spreadsheet URL returned');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error('Google Sheets export error:', err);
      toast.error("Google Sheets export failed. Please try again.");
    }
  };

  const getVerificationBadge = (isVerified: boolean, badgeColor?: string) => {
    if (!isVerified) {
      return (
        <Badge variant="outline" className="text-gray-600 border-gray-300">
          <Shield className="w-3 h-3 mr-1" />
          Not Verified
        </Badge>
      );
    }

    const colorClass = badgeColor === 'gold' ? 'text-yellow-600 border-yellow-600 bg-yellow-50' : 
                      badgeColor === 'blue' ? 'text-blue-600 border-blue-600 bg-blue-50' :
                      badgeColor === 'green' ? 'text-green-600 border-green-600 bg-green-50' :
                      badgeColor === 'silver' ? 'text-gray-600 border-gray-600 bg-gray-50' :
                      'text-green-600 border-green-600 bg-green-50';

    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={colorClass}>
          <ShieldCheck className="w-3 h-3 mr-1" />
          Verified
        </Badge>
        <VerificationBadge 
          color={badgeColor as 'gold' | 'blue' | 'green' | 'silver' || 'green'} 
          size={16} 
        />
      </div>
    );
  };

  // Show loading while checking admin status
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
              You must sign in as admin to view employer members.
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
    // Check for debug mode to show detailed error
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === '1';
    
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-destructive">Error loading employers: {error}</p>
            {debugMode && errorStage && (
              <div className="text-left bg-muted p-4 rounded-lg">
                <p className="font-semibold">Debug Info:</p>
                <p>Error Stage: {errorStage}</p>
                <p>Admin Verified: {adminVerified ? 'Yes' : 'No'}</p>
                <p>User ID: {user?.id || 'None'}</p>
              </div>
            )}
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
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
            {/* Stats with Filter Icons */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{totalCount}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {employers?.filter(e => e.is_verified).length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Verified</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {employers?.filter(e => {
                      if (!e.last_sign_in_at) return false;
                      const daysSince = Math.floor((new Date().getTime() - new Date(e.last_sign_in_at).getTime()) / (1000 * 3600 * 24));
                      return daysSince <= 7;
                    }).length || 0}
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

                {/* Status Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <Activity className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50">
                    <Select value={filters.status || "all"} onValueChange={(value) => handleFilterChange('status', value)}>
                      <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-200">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-[60] min-w-[8rem]">
                        <SelectItem value="all" className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">All Status</SelectItem>
                        <SelectItem value="active" className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Active</SelectItem>
                        <SelectItem value="inactive" className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Inactive</SelectItem>
                        <SelectItem value="banned" className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Profile Banned</SelectItem>
                        <SelectItem value="job_banned" className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Job Banned</SelectItem>
                        <SelectItem value="fully_banned" className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">Fully Banned (Both)</SelectItem>
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
              { key: 'all', label: 'All', count: employers?.length || 0 },
              { key: 'complete', label: 'Complete', count: employers?.filter(e => isEmployerComplete(e)).length || 0 },
              { key: 'incomplete', label: 'Incomplete', count: employers?.filter(e => !isEmployerComplete(e)).length || 0 },
              { key: 'new', label: 'New', count: employers?.filter(e => { if (!e.created_at) return false; return Math.floor((Date.now() - new Date(e.created_at).getTime()) / (1000 * 3600 * 24)) <= 7; }).length || 0 },
              { key: 'banned', label: 'Banned', count: employers?.filter(e => e.account_status === 'banned' || e.account_status === 'job_banned' || e.account_status === 'fully_banned').length || 0 },
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
                placeholder="Search by company name, email, phone, or ID..."
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
            {/* Limited View Warning */}
            {isLimitedView && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Limited View: Some employer statistics and features may not be available. 
                  Full admin permissions may be required for complete data access.
                </p>
              </div>
            )}

            {/* Employers Grid */}
            {filters.showDeleted ? (
              // Deleted Companies View
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-2">Deleted Companies</h3>
                  <p className="text-red-700 text-sm">
                    These companies have been deleted and can be recovered. All their data is preserved.
                  </p>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {employers?.map((employer) => (
                    <DeletedEmployerCard
                      key={employer.user_id}
                      employer={employer}
                      onRecover={recoverCompany}
                    />
                  ))}
                </div>
              </div>
            ) : (
              // Active Companies View
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredEmployers?.map((employer) => (
                  <EnhancedEmployerCard
                    key={employer.user_id}
                    employer={employer}
                    onView={handleViewEmployer}
                    onEdit={handleEditEmployer}
                    onJobPostingToggle={setJobPostingVisibility}
                    onAccountStatusChange={setAccountStatus}
                    onVerificationUpdate={refreshData}
                    isAdminUser={adminVerified}
                  />
                ))}
              </div>
            )}

            {/* Showing count */}
            {filteredEmployers?.length > 0 && (
              <div className="text-center mt-6 text-sm text-muted-foreground">
                Showing {filteredEmployers.length} of {totalCount} employers
              </div>
            )}

            {/* Empty State */}
            {employers?.length === 0 && (
              <div className="text-center py-16">
                <div className="p-4 bg-muted/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Building className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No employers found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria or filters.</p>
              </div>
            )}
          </>
        )}
      </div>


      {/* View Dialog - Enhanced Company Profile */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold">Company Profile - Comprehensive View</DialogTitle>
          </DialogHeader>
          {selectedEmployer && (
            <div className="space-y-6">
              {/* Header Section with Company Logo and Basic Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 p-4 sm:p-6 bg-gradient-card rounded-2xl">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-primary/20 mx-auto sm:mx-0">
                  <AvatarImage src={selectedEmployer.logo_url} />
                  <AvatarFallback className="bg-gradient-primary text-white text-2xl">
                    {selectedEmployer.company_name?.slice(0, 2)?.toUpperCase() || "CO"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-2xl sm:text-3xl font-bold break-words">{selectedEmployer.company_name}</h3>
                    {selectedEmployer.is_verified && (
                      <VerificationBadge 
                        color={selectedEmployer.badge_color as 'gold' | 'blue' | 'green' | 'silver' || 'gold'} 
                        size={24} 
                      />
                    )}
                  </div>
                  {selectedEmployer.legal_name && selectedEmployer.legal_name !== selectedEmployer.company_name && (
                    <p className="text-lg text-muted-foreground">Legal: {selectedEmployer.legal_name}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                    {selectedEmployer.business_type && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {selectedEmployer.business_type}
                      </Badge>
                    )}
                    <p className="text-base sm:text-lg text-muted-foreground">{selectedEmployer.industry}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                    {selectedEmployer.is_verified && selectedEmployer.verified_plan_end && new Date(selectedEmployer.verified_plan_end) > new Date('2099-01-01') && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Lifetime Verified
                      </Badge>
                    )}
                    {selectedEmployer.is_profile_complete && (
                      <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                        Complete Profile
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-center sm:text-right space-y-2">
                  <div className="text-sm text-muted-foreground">Company ID</div>
                  <div className="font-mono text-sm break-all bg-muted p-2 rounded">
                    {selectedEmployer.id || selectedEmployer.company_id}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(selectedEmployer.id || selectedEmployer.company_id)}>
                    Copy ID
                  </Button>
                </div>
              </div>

              {/* Company Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Company Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{selectedEmployer.active_jobs}</div>
                      <div className="text-sm text-muted-foreground">Active Jobs</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{selectedEmployer.total_jobs}</div>
                      <div className="text-sm text-muted-foreground">Total Jobs</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{selectedEmployer.profile_views_count}</div>
                      <div className="text-sm text-muted-foreground">Profile Views</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedEmployer.last_sign_in_at ? 
                          Math.floor((new Date().getTime() - new Date(selectedEmployer.last_sign_in_at).getTime()) / (1000 * 3600 * 24))
                          : 'Never'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">Days Since Login</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Media Links */}
              {(selectedEmployer.instagram_link || selectedEmployer.facebook_link || selectedEmployer.youtube_link || selectedEmployer.linkedin_link) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Social Media & Links</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4">
                      {selectedEmployer.instagram_link && (
                        <a href={selectedEmployer.instagram_link} target="_blank" rel="noopener noreferrer" 
                           className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 transition-colors">
                          <span>Instagram</span>
                        </a>
                      )}
                      {selectedEmployer.facebook_link && (
                        <a href={selectedEmployer.facebook_link} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                          <span>Facebook</span>
                        </a>
                      )}
                      {selectedEmployer.youtube_link && (
                        <a href={selectedEmployer.youtube_link} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
                          <span>YouTube</span>
                        </a>
                      )}
                      {selectedEmployer.linkedin_link && (
                        <a href={selectedEmployer.linkedin_link} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                          <span>LinkedIn</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Contact Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="break-words"><strong>Email:</strong> <span className="text-sm">{selectedEmployer.email}</span></div>
                    <div><strong>Phone:</strong> {selectedEmployer.phone}</div>
                    <div><strong>Location:</strong> {getCompanyDisplayLocation(selectedEmployer)}</div>
                    {selectedEmployer.whatsapp_number && (
                      <div><strong>WhatsApp:</strong> {selectedEmployer.whatsapp_number}</div>
                    )}
                    <div className="break-words"><strong>Website:</strong> 
                      {selectedEmployer.website && (
                        <a href={selectedEmployer.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1 text-sm">
                          {selectedEmployer.website}
                        </a>
                      )}
                    </div>
                    {selectedEmployer.support_email && (
                      <div className="break-words"><strong>Support Email:</strong> {selectedEmployer.support_email}</div>
                    )}
                    {selectedEmployer.hr_contact_name && (
                      <div><strong>HR Contact:</strong> {selectedEmployer.hr_contact_name}</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Company Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div><strong>Industry:</strong> {selectedEmployer.industry}</div>
                    <div><strong>Company Size:</strong> {selectedEmployer.company_size || selectedEmployer.organisation_size}</div>
                    {selectedEmployer.incorporation_date && (
                      <div><strong>Incorporation:</strong> {format(new Date(selectedEmployer.incorporation_date), "PPP")}</div>
                    )}
                    {selectedEmployer.city && (
                      <div><strong>City:</strong> {selectedEmployer.city}</div>
                    )}
                    {selectedEmployer.state && (
                      <div><strong>State:</strong> {selectedEmployer.state}</div>
                    )}
                    {selectedEmployer.country && (
                      <div><strong>Country:</strong> {selectedEmployer.country}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Legal Information */}
              {(selectedEmployer.cin_number || selectedEmployer.gst_number || selectedEmployer.msme_number || selectedEmployer.registered_address) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Legal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEmployer.cin_number && (
                      <div><strong>CIN Number:</strong> <span className="font-mono text-sm">{selectedEmployer.cin_number}</span></div>
                    )}
                    {selectedEmployer.gst_number && (
                      <div><strong>GST Number:</strong> <span className="font-mono text-sm">{selectedEmployer.gst_number}</span></div>
                    )}
                    {selectedEmployer.msme_number && (
                      <div><strong>MSME Number:</strong> <span className="font-mono text-sm">{selectedEmployer.msme_number}</span></div>
                    )}
                    {selectedEmployer.registered_address && (
                      <div className="md:col-span-2"><strong>Registered Address:</strong> {selectedEmployer.registered_address}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Company Description */}
              {(selectedEmployer.description || selectedEmployer.company_details) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">About Company</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedEmployer.description || selectedEmployer.company_details}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Company Culture & Values */}
              {(selectedEmployer.mission || selectedEmployer.vision || selectedEmployer.core_values) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Company Culture & Values</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedEmployer.mission && (
                      <div>
                        <strong className="block mb-2">Mission:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.mission}</p>
                      </div>
                    )}
                    {selectedEmployer.vision && (
                      <div>
                        <strong className="block mb-2">Vision:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.vision}</p>
                      </div>
                    )}
                    {selectedEmployer.core_values && (
                      <div>
                        <strong className="block mb-2">Core Values:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.core_values}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Services & Business Information */}
              {(selectedEmployer.services_description || selectedEmployer.differentiating_factors) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Services & Business</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedEmployer.services_description && (
                      <div>
                        <strong className="block mb-2">Services:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.services_description}</p>
                      </div>
                    )}
                    {selectedEmployer.differentiating_factors && (
                      <div>
                        <strong className="block mb-2">Differentiating Factors:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.differentiating_factors}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Founder & Team Information */}
              {(selectedEmployer.founder_name || selectedEmployer.founder_bio || selectedEmployer.key_team_members) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Leadership & Team</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedEmployer.founder_name && (
                      <div>
                        <strong className="block mb-2">Founder:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.founder_name}</p>
                      </div>
                    )}
                    {selectedEmployer.founder_bio && (
                      <div>
                        <strong className="block mb-2">Founder Bio:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.founder_bio}</p>
                      </div>
                    )}
                    {selectedEmployer.key_team_members && (
                      <div>
                        <strong className="block mb-2">Key Team Members:</strong>
                        <p className="text-muted-foreground">{selectedEmployer.key_team_members}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Registration Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Registration Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><strong>Joined:</strong> {format(new Date(selectedEmployer.created_at), "PPP")}</div>
                  <div><strong>Last Sign In:</strong> 
                    {selectedEmployer.last_sign_in_at ? 
                      format(new Date(selectedEmployer.last_sign_in_at), "PPP") : 
                      "Never signed in"
                    }
                  </div>
                  {selectedEmployer.verified_plan_start && (
                    <div><strong>Verified Since:</strong> {format(new Date(selectedEmployer.verified_plan_start), "PPP")}</div>
                  )}
                  {selectedEmployer.verified_plan_end && new Date(selectedEmployer.verified_plan_end) < new Date('2099-01-01') && (
                    <div><strong>Verification Expires:</strong> {format(new Date(selectedEmployer.verified_plan_end), "PPP")}</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}