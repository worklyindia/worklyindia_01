import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";

import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppUnreadTotal } from "@/hooks/useWhatsAppUnreadTotal";
import { toast } from "sonner";
import { useAnimatedPlaceholder, searchPlaceholders } from "@/hooks/useAnimatedPlaceholder";
import Lottie from "lottie-react";
import chatbotAnimation from "@/assets/chatbot.json";
import { 
  Building2, 
  Users, 
  Briefcase, 
  Plus,
  Search,
  
  Settings,
  BarChart3,
  Calendar,
  Star,
  Filter,
  Menu,
  Code2,
  X,
  Clock,
  AlertCircle,
  Copy,
  Eye,
  Coins,
  RotateCcw,
  Mail,
  Phone,
  Bot,
  Trash2,
  Loader2,
  Globe,
  MessageCircle,
  CreditCard
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { DEFAULT_COMPANY_LOGO } from "@/utils/defaultAvatars";
import BoostJobDialog from "@/components/BoostJobDialog";
import BoostDetailsDialog from "@/components/BoostDetailsDialog";
import VerificationBadgeDialog from "@/components/VerificationBadgeDialog";
import { ExtendJobDialog } from "@/components/ExtendJobDialog";
import ReferralDashboard from "@/components/referral/ReferralDashboard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import JobStatusBadge from "@/components/JobStatusBadge";

import VerificationSection from "@/components/VerificationSection";
import AnalyticsView from "@/components/AnalyticsView";
import { useApplicantNotifications } from "@/hooks/useApplicantNotifications";
import { useEmployerSettings } from "@/hooks/useEmployerSettings";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { UniversalNotificationPermission } from "@/components/UniversalNotificationPermission";
import { usePushInit } from "@/hooks/usePushInit";
import { usePeriodicNotificationPrompt } from "@/hooks/usePeriodicNotificationPrompt";
import { usePerJobApplicantCounts } from "@/hooks/usePerJobApplicantCounts";
import { normalizeImageUrl } from "@/utils/imageUrl";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import PageHeader from "@/components/PageHeader";



const EmployerPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, company, updateCompany } = useEmployerAuth();
  
  const { newApplicantCount, markApplicantNotificationsAsRead } = useApplicantNotifications();
  const { settings: employerSettings, isLoading: settingsLoading } = useEmployerSettings();
  const { counts: perJobApplicantCounts, markJobAsViewed } = usePerJobApplicantCounts();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [filterPublishMode, setFilterPublishMode] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const animatedPlaceholder = useAnimatedPlaceholder(searchPlaceholders);
  const [shortlistedCounts, setShortlistedCounts] = useState<{ [jobId: string]: number }>({});
  const [boostJobDialog, setBoostJobDialog] = useState(false);
  const [boostDetailsDialog, setBoostDetailsDialog] = useState(false);
  const [verifyDialog, setVerifyDialog] = useState(false);
  const [selectedJobForBoost, setSelectedJobForBoost] = useState<{id: string, title: string} | null>(null);
  const [extendJobId, setExtendJobId] = useState<string | null>(null);
  const [jobIndexingStatus, setJobIndexingStatus] = useState<{ [jobId: string]: { 
    googleStatus: string | null;
    googleQueuedAt: string | null;
    googleScheduledAt: string | null;
    googleSubmittedAt: string | null;
    googlePublicAt: string | null;
    googleError: string | null;
    bingStatus: string | null;
    bingQueuedAt: string | null;
    bingScheduledAt: string | null;
    bingSubmittedAt: string | null;
    bingPublicAt: string | null;
    bingError: string | null;
    isPaidForIndexing: boolean;
  } }>({});


  // Initialize OneSignal and show permission prompt if needed
  const { isInitialized, hasPermission } = usePushInit();
  
  // Enhanced notification prompt for employers
  const {
    showPrompt: showNotificationPrompt,
    handleDismiss: handleNotificationDismiss
  } = usePeriodicNotificationPrompt({
    enabled: true,
    intervalMinutes: 5, // Show every 5 minutes for employers
    maxAttempts: 15 // Show up to 15 times for employers
  });

  // Handle URL parameters to set active tab with improved persistence
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['dashboard', 'jobs', 'interviews', 'analytics', 'verification', 'contact', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam);
      // Store the current tab in sessionStorage to preserve during refresh
      try {
        sessionStorage.setItem('employerPortalActiveTab', tabParam);
      } catch (e) {
        // Ignore storage errors
      }
    } else {
      // If no tab param, try to restore from sessionStorage
      try {
        const savedTab = sessionStorage.getItem('employerPortalActiveTab');
        if (savedTab && ['dashboard', 'jobs', 'interviews', 'analytics', 'verification', 'contact', 'settings'].includes(savedTab)) {
          setActiveTab(savedTab);
          // Update URL to reflect the restored tab without causing navigation
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('tab', savedTab);
          window.history.replaceState({}, '', newUrl.toString());
        }
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [searchParams]);

  // Real-time subscription for job_indexing_status updates (4-stage tracking)
  useEffect(() => {
    const channel = supabase
      .channel('job-indexing-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_indexing_status'
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData && newData.job_id) {
            console.log('Real-time indexing update:', newData.job_id, newData.google_status, newData.bing_status);
            setJobIndexingStatus(prev => ({
              ...prev,
              [newData.job_id]: {
                googleStatus: newData.google_status,
                googleQueuedAt: newData.google_queued_at,
                googleScheduledAt: newData.google_scheduled_at,
                googleSubmittedAt: newData.google_submitted_at,
                googlePublicAt: newData.google_public_at,
                googleError: newData.google_error,
                bingStatus: newData.bing_status,
                bingQueuedAt: newData.bing_queued_at,
                bingScheduledAt: newData.bing_scheduled_at,
                bingSubmittedAt: newData.bing_submitted_at,
                bingPublicAt: newData.bing_public_at,
                bingError: newData.bing_error,
                isPaidForIndexing: !!newData.is_paid_for_indexing
              }
            }));

          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper function to change tabs and persist the selection
  const changeTab = (tabId: string) => {
    setActiveTab(tabId);
    // Update URL with new tab
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tab', tabId);
    window.history.pushState({}, '', newUrl.toString());
    // Store in sessionStorage for refresh persistence
    try {
      sessionStorage.setItem('employerPortalActiveTab', tabId);
    } catch (e) {
      // Ignore storage errors
    }
  };

  const stats = {
    activeJobs: jobs.filter(job => job.status === 'active').length,
    totalApplications: applications.length,
    shortlisted: applications.filter(app => app.status === 'shortlisted').length,
    interviews: applications.filter(app => app.status === 'interviewed').length
  };

  useEffect(() => {
    if (user && company) {
      fetchJobsAndApplications();
    }
  }, [user, company]);

  const fetchJobsAndApplications = async () => {
    if (!user || !company?.id) return;
    
    setLoading(true);
    try {
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        throw jobsError;
      }
      setJobs(jobsData || []);

      // Fetch applications for all jobs
      if (jobsData && jobsData.length > 0) {
        const jobIds = jobsData.map((job: any) => job.id);

        // Fetch applications (non-blocking: indexing badges should still load even if this fails)
        let applicationsData: any[] = [];
        const { data: applicationsRes, error: applicationsError } = await supabase
          .from('job_applications')
          .select(`
            *,
            profiles:user_id (full_name, phone, location, current_position)
          `)
          .in('job_id', jobIds)
          .order('applied_at', { ascending: false });

        if (applicationsError) {
          console.error('Error fetching applications (continuing):', applicationsError);
        } else {
          applicationsData = applicationsRes || [];
        }

        setApplications(applicationsData || []);

        // Calculate shortlisted counts per job
        const counts: { [jobId: string]: number } = {};
        applicationsData?.forEach((app: any) => {
          if (app.status === 'shortlisted') {
            counts[app.job_id] = (counts[app.job_id] || 0) + 1;
          }
        });
        setShortlistedCounts(counts);

        // Fetch indexing status from job_indexing_status table (4-stage tracking)
        const { data: indexingData, error: indexingError } = await supabase
          .from('job_indexing_status')
          .select('job_id, google_status, google_queued_at, google_scheduled_at, google_submitted_at, google_public_at, google_error, bing_status, bing_queued_at, bing_scheduled_at, bing_submitted_at, bing_public_at, bing_error, is_paid_for_indexing')
          .in('job_id', jobIds);

        if (indexingError) {
          console.error('Indexing fetch error:', indexingError);
        }

        console.log('Indexing data fetched:', { count: indexingData?.length, jobIds: jobIds.slice(0, 3), sample: indexingData?.[0] });

        if (indexingData && indexingData.length > 0) {
          const indexingMap: { [jobId: string]: { 
            googleStatus: string | null;
            googleQueuedAt: string | null;
            googleScheduledAt: string | null;
            googleSubmittedAt: string | null;
            googlePublicAt: string | null;
            googleError: string | null;
            bingStatus: string | null;
            bingQueuedAt: string | null;
            bingScheduledAt: string | null;
            bingSubmittedAt: string | null;
            bingPublicAt: string | null;
            bingError: string | null;
            isPaidForIndexing: boolean;
          }} = {};
          
          indexingData.forEach((entry: any) => {
            indexingMap[entry.job_id] = {
              googleStatus: entry.google_status,
              googleQueuedAt: entry.google_queued_at,
              googleScheduledAt: entry.google_scheduled_at,
              googleSubmittedAt: entry.google_submitted_at,
              googlePublicAt: entry.google_public_at,
              googleError: entry.google_error,
              bingStatus: entry.bing_status,
              bingQueuedAt: entry.bing_queued_at,
              bingScheduledAt: entry.bing_scheduled_at,
              bingSubmittedAt: entry.bing_submitted_at,
              bingPublicAt: entry.bing_public_at,
              bingError: entry.bing_error,
              isPaidForIndexing: !!entry.is_paid_for_indexing
            };
          });

          console.log('Indexing map built:', Object.keys(indexingMap).length, 'jobs mapped');
          setJobIndexingStatus(indexingMap);
        } else {
          console.log('No indexing data found for jobs');
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Removed toast error to prevent recurring popups
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = () => {
    navigate("/Employer/Setup");
  };

  // Filtered jobs based on search and multiple filters
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch = searchTerm === "" || 
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.department?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === "all" || job.status === filterStatus;
      
      const matchesVisibility = filterVisibility === "all" || 
        (job.visibility || "public") === filterVisibility;
      
      const matchesPublishMode = filterPublishMode === "all" || 
        (job.publish_mode || "immediate") === filterPublishMode;
      
      const matchesDepartment = filterDepartment === "all" || 
        job.department === filterDepartment;
      
      return matchesSearch && matchesStatus && matchesVisibility && 
             matchesPublishMode && matchesDepartment;
    });
  }, [jobs, searchTerm, filterStatus, filterVisibility, filterPublishMode, filterDepartment]);

  const handleBoostJob = (jobId: string, jobTitle: string, isBoosted: boolean = false) => {
    setSelectedJobForBoost({ id: jobId, title: jobTitle });
    if (isBoosted) {
      setBoostDetailsDialog(true);
    } else {
      setBoostJobDialog(true);
    }
  };

  const handleVerifyCompany = () => {
    setVerifyDialog(true);
  };

  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const handleDeleteJob = async (jobId: string, jobTitle: string) => {
    setDeleteLoading(jobId);
    try {
      // Clean up job images from storage before deleting the job
      try {
        const { data: jobImagesData } = await supabase
          .from('job_images')
          .select('image_url')
          .eq('job_id', jobId);
        if (jobImagesData && jobImagesData.length > 0) {
          const { cleanupJobImages } = await import('@/utils/storageCleanup');
          await cleanupJobImages(jobImagesData.map((img) => img.image_url));
        }
      } catch (imgErr) {
        console.warn('Job image cleanup skipped:', imgErr);
      }

      // Delete from Telegram channel first (if posted there)
      try {
        await supabase.functions.invoke('email-api/telegram', { body: { action: 'channel-delete', job_id: jobId }
        });
      } catch (tgErr) {
        console.warn('Telegram channel delete skipped:', tgErr);
      }

      // Hard delete - triggers URL_DELETED in indexing queue via database trigger
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
      
      toast.success(`"${jobTitle}" deleted permanently from Google & Bing`);
      fetchJobsAndApplications(); // Refresh data
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    } finally {
      setDeleteLoading(null);
    }
  };

  const getExpiryInfo = (job: any) => {
    const expiryDate = job.expires_at ? new Date(job.expires_at) : new Date(new Date(job.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const isExpiringSoon = daysLeft <= 7;
    const isExpired = daysLeft <= 0;
    
    return {
      expiryDate: expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      daysLeft: Math.max(0, daysLeft),
      isExpiringSoon,
      isExpired
    };
  };

  const waUnread = useWhatsAppUnreadTotal({ companyId: company?.id });
  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { 
      id: "jobs", 
      label: "Job Postings", 
      icon: Briefcase, 
      count: newApplicantCount,
      onClick: () => markApplicantNotificationsAsRead() 
    },
    { id: "interviews", label: "Interviews", icon: Calendar },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "whatsapp", label: "Workly Chat", icon: MessageCircle, count: waUnread, onClick: () => navigate('/employer/workly-chat') },
    { id: "email", label: "Workly Email", icon: Mail, onClick: () => navigate('/employer/workly-email') },
    { id: "ai-chat", label: "AI Chat", icon: Bot, onClick: () => navigate('/ai-assistant?audience=employer') },
    { id: "verification", label: "Verification Status", icon: Star },
    { id: "refer", label: "Refer", icon: Users },
    { id: "domains", label: "Domains", icon: Globe, onClick: () => navigate('/domains') },
    { id: "developers", label: "Developer Portal", icon: Code2, onClick: () => navigate('/developers') },
    { id: "contact", label: "Contact Us", icon: Phone, onClick: () => navigate('/contact-us') },
    { id: "payment-history", label: "Payment History", icon: CreditCard, onClick: () => navigate('/payment-history') },
    { id: "settings", label: "Settings", icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden" style={{
      touchAction: 'manipulation',
      WebkitTextSizeAdjust: '100%',
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      KhtmlUserSelect: 'none',
      MozUserSelect: 'none',
      userSelect: 'none'
    }}>
      {/* Employer Portal Header - Completely Different Design */}
      {activeTab === 'jobs' || activeTab === 'verification' ? (
        <PageHeader
          title={activeTab === 'jobs' ? 'Job Postings' : 'Verification Status'}
          onBack={() => changeTab('dashboard')}
        />
      ) : <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Mobile Menu */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted relative"
              >
                <Menu className="w-5 h-5" />
                {newApplicantCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  </span>
                )}
              </Button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-display text-foreground">HirePortal</h1>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Employer Dashboard</p>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
                <Input
                  type="text"
                  placeholder="Search candidates, jobs..."
                  className="pl-10 bg-muted/50 border-border focus:bg-card"
                />
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden md:flex"
                disabled={settingsLoading || !employerSettings?.job_posting_visibility || (company as any)?.ban_type === 'job_posting'}
                onClick={() => {
                  if (!employerSettings?.job_posting_visibility || (company as any)?.ban_type === 'job_posting') {
                    toast.error("Job posting has been temporarily paused by admin. Please contact support for assistance.");
                    return;
                  }
                  navigate("/post-job");
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Post Job
              </Button>
              <Button 
                variant="ghost"
                size="icon"
                aria-label="AI Career Chat"
                className="rounded-full w-10 h-10 p-1 border border-primary/30 bg-primary/5 transition-all duration-100 hover:bg-primary/10"
                onClick={() => navigate("/ai-assistant?audience=employer")}
              >
                <LottieSearchIcon size={22} />
              </Button>
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors"
                onClick={() => {
                  if (company?.is_profile_complete) {
                    navigate("/employer-profile");
                  } else {
                    navigate("/Employer/Setup");
                  }
                }}
              >
                <Avatar className="w-8 h-8">
                  <SafeAvatarImage
                    src={normalizeImageUrl(company?.logo_url) || DEFAULT_COMPANY_LOGO}
                    alt={`${company?.company_name || 'Company'} logo`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                    {company?.company_name?.substring(0, 2).toUpperCase() || "CO"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-foreground">
                    {company?.company_name || "My Company"}
                  </p>
                  <p className="text-xs text-muted-foreground">HR Manager</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>}

      <div className="flex">
        {/* Sidebar Navigation - Different Style */}
        <aside className="hidden w-72 shrink-0 border-r border-border bg-card lg:static lg:flex">
          <div className="flex flex-col h-full min-h-0 lg:pt-4">
            <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-2" aria-label="Employer menu">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    variant="ghost"
                    key={item.id}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      if (item.id === "settings") {
                        navigate("/employer-settings");
                      } else if (item.id === "interviews") {
                        navigate("/employer/interviews");
                      } else if (item.id === "refer") {
                        navigate("/employer/referral");
                      } else {
                        changeTab(item.id);
                      }
                      setSidebarOpen(false);
                    }}
                    className={`h-auto w-full justify-between px-3 py-2.5 text-left
                      ${activeTab === item.id
                        ? 'bg-primary/10 text-primary border-l-4 border-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {!!item.count && item.count > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-xs">
                        {item.count > 99 ? '99+' : item.count}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </nav>
            <div className="border-t border-border p-4">
            <Button variant="outline" className="h-11 w-full justify-start gap-3" onClick={() => { try { sessionStorage.setItem("employerViewWebsite", "1"); } catch { /* ignore */ } setSidebarOpen(false); navigate("/"); }}>
              <Globe className="h-5 w-5 shrink-0" /> <span className="font-medium">Visit Website</span>
            </Button>
            </div>
          </div>
        </aside>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-screen max-w-none overflow-x-hidden overflow-y-auto px-4 sm:w-[85vw] sm:max-w-sm sm:px-6 lg:hidden">
            <SheetHeader className="border-b border-border pb-4 text-left">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </span>
                <span className="text-base">HirePortal Menu</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-4 space-y-1" aria-label="Employer mobile menu">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={`h-12 w-full justify-between px-3 ${activeTab === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      if (item.id === "settings") navigate("/employer-settings");
                      else if (item.id === "interviews") navigate("/employer/interviews");
                      else if (item.id === "refer") navigate("/employer/referral");
                      else changeTab(item.id);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="truncate font-medium">{item.label}</span>
                    </span>
                    {!!item.count && item.count > 0 && <Badge variant="destructive">{item.count > 99 ? '99+' : item.count}</Badge>}
                  </Button>
                );
              })}
            </nav>
            <div className="mt-4 border-t border-border pt-4">
            <Button variant="outline" className="h-12 w-full justify-start gap-3" onClick={() => { try { sessionStorage.setItem("employerViewWebsite", "1"); } catch { /* ignore */ } setSidebarOpen(false); navigate("/"); }}>
              <Globe className="h-5 w-5 shrink-0" /> <span className="font-medium">Visit Website</span>
            </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0 w-full min-w-0">
          <div className="max-w-7xl mx-auto px-2 xs:px-4 sm:px-6 lg:px-8 py-4 xs:py-6 lg:py-8">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-6">
            {activeTab === "dashboard" && (
              <div className="space-y-8">
                 
                 {/* Welcome Section */}
                 <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-4 xs:p-6 sm:p-8 text-primary-foreground">
                   <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold font-display mb-2">
                     Welcome back, {company?.company_name}!
                   </h2>
                   <p className="text-primary-foreground/80 mb-4 xs:mb-6 text-sm xs:text-base">Manage your hiring process efficiently</p>
                   <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4">
                     <Button 
                       className="bg-card text-primary hover:bg-card/90 w-full sm:w-auto flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                       onClick={() => {
                         if (employerSettings?.job_posting_visibility === false || company?.job_posting_visibility === false) {
                           toast.error("Job posting is disabled. Contact admin for assistance.");
                           return;
                         }
                         navigate("/post-job");
                       }}
                       disabled={employerSettings?.job_posting_visibility === false || company?.job_posting_visibility === false}
                       title={
                         (employerSettings?.job_posting_visibility === false || company?.job_posting_visibility === false)
                           ? "Job posting is disabled by admin"
                           : "Create a new job posting"
                       }
                     >
                       <Plus className="w-4 h-4 mr-2" />
                       Post New Job
                     </Button>
                     <Button 
                       variant="outline" 
                       className="border-2 border-primary-foreground text-primary-foreground bg-transparent hover:bg-card hover:text-primary w-full sm:w-auto flex-shrink-0"
                       onClick={() => changeTab("analytics")}
                     >
                       <BarChart3 className="w-4 h-4 mr-2" />
                       View Analytics
                     </Button>
                   </div>
                 </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-6">
                  <Card className="p-4 xs:p-6 border-l-4 border-l-primary">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm font-medium">Active Jobs</p>
                        <p className="text-3xl font-bold font-display text-foreground">{stats.activeJobs}</p>
                      </div>
                      <Briefcase className="w-8 h-8 text-primary" />
                    </div>
                  </Card>
                  <Card className="p-4 xs:p-6 border-l-4 border-l-success">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm font-medium">Applications</p>
                        <p className="text-3xl font-bold font-display text-foreground">{stats.totalApplications}</p>
                      </div>
                      <Users className="w-8 h-8 text-success" />
                    </div>
                  </Card>
                  <Card className="p-4 xs:p-6 border-l-4 border-l-warning">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm font-medium">Shortlisted</p>
                        <p className="text-3xl font-bold font-display text-foreground">{stats.shortlisted}</p>
                      </div>
                      <Star className="w-8 h-8 text-warning" />
                    </div>
                  </Card>
                  <Card className="p-4 xs:p-6 border-l-4 border-l-secondary">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm font-medium">Interviews</p>
                        <p className="text-3xl font-bold font-display text-foreground">{stats.interviews}</p>
                      </div>
                      <Calendar className="w-8 h-8 text-secondary" />
                    </div>
                  </Card>
                </div>

                {/* Recent Activity Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Recent Jobs */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold font-display text-foreground">Recent Job Postings</h3>
                      <Button variant="outline" size="sm" onClick={() => changeTab("jobs")}>View All</Button>
                    </div>
                    <div className="space-y-4">
                      {jobs.slice(0, 3).map((job) => (
                        <div key={job.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                          <div>
                            <h4 className="font-medium text-foreground">{job.title}</h4>
                            <p className="text-sm text-muted-foreground">{job.department} • {new Date(job.created_at).toLocaleDateString()}</p>
                            {(() => {
                              const expiryInfo = getExpiryInfo(job);
                              return (
                                 <p className={`text-xs mt-1 ${
                                   expiryInfo.isExpired ? 'text-red-600' : 
                                    expiryInfo.isExpiringSoon ? 'text-warning' : 
                                    'text-muted-foreground'
                                 }`}>
                                   {expiryInfo.isExpired ? 'Expired' : 
                                    `Expires ${expiryInfo.expiryDate} (${expiryInfo.daysLeft} days left)`}
                                   {!expiryInfo.isExpired && (
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setExtendJobId(job.id);
                                       }}
                                       className="ml-1 p-0.5 hover:bg-muted rounded transition-colors inline-flex items-center"
                                       title="Extend job duration"
                                     >
                                        <RotateCcw className="w-3 h-3 text-primary" />
                                     </button>
                                   )}
                                 </p>
                              );
                            })()}
                            <div className="flex items-center space-x-4 mt-2">
                               <span className="text-xs text-muted-foreground">{job.applications_count} applications</span>
                              <span className="text-xs text-muted-foreground">{job.views_count} views</span>
                            </div>
                          </div>
                          <Badge variant={job.status === "active" ? "default" : "secondary"}>
                            {job.status}
                          </Badge>
                        </div>
                      ))}
                      {jobs.length === 0 && (
                        <div className="text-center py-6 text-muted-foreground">
                          <p>No jobs posted yet</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => navigate("/post-job")}
                          >
                            Post Your First Job
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>

                </div>
              </div>
            )}

            {/* Jobs Tab */}
            {activeTab === "jobs" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button 
                    className="bg-primary hover:bg-primary/90 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (employerSettings?.job_posting_visibility === false || company?.job_posting_visibility === false) {
                        toast.error("Job posting is disabled. Contact admin for assistance.");
                        return;
                      }
                      navigate("/post-job");
                    }}
                    disabled={employerSettings?.job_posting_visibility === false || company?.job_posting_visibility === false}
                    title={
                      (employerSettings?.job_posting_visibility === false || company?.job_posting_visibility === false)
                        ? "Job posting is disabled by admin"
                        : "Create a new job posting"
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Post New Job
                  </Button>
                </div>

                <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 mb-6">
                  <div className="flex-1">
                    <Input 
                      placeholder={animatedPlaceholder} 
                      className="w-full bg-card" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  {/* Filter Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {/* Status Filter */}
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                     <SelectTrigger className="bg-card">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Visibility Filter */}
                    <Select value={filterVisibility} onValueChange={setFilterVisibility}>
                     <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Visibility</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="unlisted">Unlisted</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Publish Mode Filter */}
                    <Select value={filterPublishMode} onValueChange={setFilterPublishMode}>
                     <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Publishing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Publishing</SelectItem>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="schedule">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Department Filter */}
                    <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Human Resources">Human Resources</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-6">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="p-6 hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-xl font-semibold font-display text-foreground line-clamp-2 break-words mb-2">{job.title}</h3>
                          <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
                            <span>{job.department}</span>
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(job.created_at).toLocaleDateString()}
                            </span>
                            {(() => {
                              const expiryInfo = getExpiryInfo(job);
                              return (
                                <span className={`flex items-center ${
                                  expiryInfo.isExpired ? 'text-red-600' : 
                                  expiryInfo.isExpiringSoon ? 'text-orange-600' : 
                                  'text-slate-600'
                                }`}>
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {expiryInfo.isExpired ? 'Expired' : 
                                   `Expires ${expiryInfo.expiryDate} (${expiryInfo.daysLeft} days left)`}
                                  {!expiryInfo.isExpired && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExtendJobId(job.id);
                                      }}
                                      className="ml-1 p-0.5 hover:bg-slate-200 rounded transition-colors"
                                      title="Extend job duration"
                                    >
                                      <RotateCcw className="w-3 h-3 text-blue-600" />
                                    </button>
                                  )}
                                </span>
                              );
                            })()}
                            <span className="flex items-center gap-1">
                              <span>ID: {job.short_id || job.id.slice(-6)}</span>
                              <button
                                onClick={() => {
                                  const displayId = job.short_id || job.id.slice(-6);
                                  navigator.clipboard.writeText(displayId);
                                  toast.success('Job ID copied to clipboard');
                                }}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                                title="Copy Job ID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </span>
                          </div>
                          <JobStatusBadge 
                            status={job.status || "active"}
                            visibility={job.visibility || "public"}
                            scheduledAt={job.scheduled_at}
                            className="mt-2"
                          />

                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{job.applications_count}</p>
                          <p className="text-xs text-slate-500">Applications</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-900">{job.views_count}</p>
                          <p className="text-xs text-slate-500">Views</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{shortlistedCounts[job.id] || 0}</p>
                          <p className="text-xs text-slate-500">Shortlisted</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-4 relative"
                          onClick={async () => {
                            await markJobAsViewed(job.id);
                            navigate(`/job/${job.id}/applicants`);
                          }}
                        >
                          Applicants
                          {perJobApplicantCounts[job.id]?.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                              {perJobApplicantCounts[job.id].unread_count > 99 ? '99+' : perJobApplicantCounts[job.id].unread_count}
                            </span>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
                          onClick={() => navigate(`/job/${job.id}/edit`)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
                          onClick={() => navigate(`/job/${job.id}/analytics`)}
                        >
                          Analytics
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className={`w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-4 ${
                            (job.is_boosted && (!job.boost_end_date || new Date(job.boost_end_date) > new Date())) 
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:text-white'
                              : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 hover:text-white'
                          }`}
                          onClick={() => handleBoostJob(job.id, job.title, !!job.is_boosted && (!job.boost_end_date || new Date(job.boost_end_date) > new Date()))}
                        >
                          {(job.is_boosted && (!job.boost_end_date || new Date(job.boost_end_date) > new Date())) ? '✨ Boost Details' : '🚀 Boost Job'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
                          onClick={() => navigate(`/job/${job.id}`)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="w-full sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
                              disabled={deleteLoading === job.id}
                            >
                              {deleteLoading === job.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3 mr-1" />
                              )}
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Job Permanently?</AlertDialogTitle>
                              <AlertDialogDescription className="space-y-3">
                                <p>Are you sure you want to delete <strong>"{job.title}"</strong>?</p>
                                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                                  <p>This will:</p>
                                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>Remove job from website immediately</li>
                                    <li>Delete from Google search index</li>
                                    <li>Delete from Bing search index</li>
                                  </ul>
                                </div>
                                <p className="text-destructive font-medium">This action cannot be undone.</p>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteJob(job.id, job.title)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete Permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </Card>
                  ))}
                  
                  {filteredJobs.length === 0 && jobs.length > 0 && (
                    <Card className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No jobs found</h3>
                      <p className="text-slate-500 mb-4">
                        No jobs match your current search or filter criteria.
                      </p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setFilterStatus("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    </Card>
                  )}
                  
                  {jobs.length === 0 && (
                    <Card className="p-8 text-center">
                      <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No job postings yet</h3>
                      <p className="text-slate-500 mb-4">
                        Start by creating your first job posting to attract candidates.
                      </p>
                      <Button onClick={() => navigate("/post-job")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Post Your First Job
                      </Button>
                    </Card>
                  )}
                </div>
              </div>
            )}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <BarChart3 className="w-8 h-8 text-blue-500" />
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
                    <p className="text-slate-600">Track your hiring performance</p>
                  </div>
                </div>
                <AnalyticsView />
              </div>
            )}

            {/* Other tabs content */}

            {activeTab === "interviews" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">Interview Schedule</h2>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Interview
                  </Button>
                </div>

                <div className="grid gap-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Today's Interviews</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Rahul Sharma</h4>
                            <p className="text-sm text-slate-600">Senior Frontend Developer</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">2:00 PM - 3:00 PM</p>
                          <p className="text-sm text-slate-600">Google Meet</p>
                        </div>
                        <Button size="sm">Join Interview</Button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Priya Patel</h4>
                            <p className="text-sm text-slate-600">Product Manager</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">4:30 PM - 5:30 PM</p>
                          <p className="text-sm text-slate-600">Google Meet</p>
                        </div>
                        <Button size="sm" variant="outline">Reschedule</Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "verification" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div>
                    <p className="text-slate-600">Manage your company verification and premium features</p>
                  </div>
                </div>
                <VerificationSection />
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <Settings className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Settings</h2>
                  <p className="text-slate-600 mb-6">Manage your employer account settings and preferences</p>
                  <Button 
                    onClick={() => navigate('/employer-settings')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Go to Settings
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "refer" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Users className="w-8 h-8 text-green-500" />
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Referral System</h1>
                    <p className="text-slate-600">Refer new users and earn 50% commission on their payments</p>
                  </div>
                </div>
                <ReferralDashboard />
              </div>
            )}

            </div>
            )}

          </div>
        </main>
        
        {/* Dialogs */}
        {selectedJobForBoost && (
          <>
            <BoostJobDialog
              open={boostJobDialog}
              onOpenChange={setBoostJobDialog}
              jobId={selectedJobForBoost.id}
              jobTitle={selectedJobForBoost.title}
              onSuccess={() => {
                fetchJobsAndApplications();
                setBoostJobDialog(false);
                setSelectedJobForBoost(null);
              }}
            />
            <BoostDetailsDialog
              open={boostDetailsDialog}
              onOpenChange={(open) => {
                setBoostDetailsDialog(open);
                if (!open) setSelectedJobForBoost(null);
              }}
              jobId={selectedJobForBoost.id}
              jobTitle={selectedJobForBoost.title}
            />
          </>
        )}

        <VerificationBadgeDialog
          open={verifyDialog}
          onOpenChange={setVerifyDialog}
          onSuccess={() => {
            // Refresh company data
            fetchJobsAndApplications();
          }}
        />


      </div>
      {/* Extend Job Dialog */}
      {extendJobId && (
        <ExtendJobDialog
          open={!!extendJobId}
          onOpenChange={() => setExtendJobId(null)}
          job={jobs.find(j => j.id === extendJobId) || { 
            id: extendJobId, 
            title: 'Job', 
            created_at: new Date().toISOString(),
            expires_at: jobs.find(j => j.id === extendJobId)?.expires_at
          }}
          onSuccess={() => {
            fetchJobsAndApplications();
            setExtendJobId(null);
          }}
        />
      )}
    </div>
  );
};

export default EmployerPortal;
