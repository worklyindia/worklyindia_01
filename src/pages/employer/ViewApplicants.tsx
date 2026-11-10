import { useState, useEffect } from "react";
import { goBack } from "@/lib/goBack";
import { downloadFileDirectly } from "@/utils/downloadFile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Star, 
  MapPin, 
  Calendar,
  Download,
  Eye,
  Phone,
  Mail,
  Clock,
  Users,
  ChevronDown,
  CheckCircle,
  XCircle,
  UserCheck,
  FileText,
  FileSpreadsheet,
  Table
} from "lucide-react";
import jsPDF from 'jspdf';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useParams } from "react-router-dom";
import { useJobApplicants } from "@/hooks/useJobApplicants";
import { useWakeRefetch } from "@/hooks/useWakeRefetch";
import { toast } from "sonner";
import ApplicantProfileDialog from "@/components/ApplicantProfileDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { downloadViaEdgeFunction, formatApplicantsForDownload } from "@/utils/edgeFunctionDownload";
import { SITE_CONFIG } from "@/config/siteConfig";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const ViewApplicants = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApplicant, setSelectedApplicant] = useState<any>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  
  const { applicants, loading, error, updateApplicationStatus, statusCounts, refetch } = useJobApplicants(jobId);

  // Refetch on tab wake so applicant list doesn't stay stuck after screen off/on
  useWakeRefetch(refetch, !!jobId);

  // Mark job applicants as viewed when page loads
  useEffect(() => {
    const markAsViewed = async () => {
      if (!jobId || !user?.id) return;
      
      try {
        await supabase.rpc('mark_job_applicants_viewed', {
          p_job_id: jobId,
          p_employer_id: user.id
        });
      } catch (err) {
        console.error('Error marking applicants as viewed:', err);
      }
    };

    markAsViewed();
  }, [jobId, user?.id]);

  const getStatusDisplayName = (status: string) => {
    switch (status.toLowerCase()) {
      case "applied": return "Applied";
      case "reviewed": return "Under Review";
      case "shortlisted": return "Shortlisted";
      case "interview_scheduled": return "Interview Scheduled";
      case "rejected": return "Rejected";
      case "hired": return "Hired";
      default: return status;
    }
  };

  // CSV Export via Edge Function
  const exportAsCSV = async () => {
    const filteredApplicants = filterApplicants(activeTab);
    if (filteredApplicants.length === 0) {
      toast.error("No applicants to export");
      return;
    }

    const { data, config } = formatApplicantsForDownload(filteredApplicants, jobTitle);
    
    const success = await downloadViaEdgeFunction(
      'csv',
      `WFH_INDIA_${jobTitle}_applicants_${new Date().toISOString().split('T')[0]}`,
      data,
      'applicants-list',
      config
    );

    if (!success) {
      // Fallback to local CSV
      fallbackExportCSV(filteredApplicants);
    }
  };

  const fallbackExportCSV = (filteredApplicants: any[]) => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Position', 'Company', 'Location', 'Skills', 'Status', 'Applied Date'].join(','),
      ...filteredApplicants.map(applicant => {
        const isGuestOrApiSource = applicant.application_source === 'api' || !applicant.user_id;
        return [
          isGuestOrApiSource ? (applicant.api_full_name || '') : (applicant.profile?.full_name || ''),
          isGuestOrApiSource ? (applicant.api_email || '') : (applicant.profile?.email || ''),
          isGuestOrApiSource ? (applicant.api_phone || '') : (applicant.profile?.phone || ''),
          isGuestOrApiSource ? (applicant.api_current_position || '') : (applicant.profile?.current_position || ''),
          isGuestOrApiSource ? (applicant.api_company || '') : (applicant.profile?.company || ''),
          isGuestOrApiSource ? (applicant.api_location || '') : (applicant.profile?.location || ''),
          isGuestOrApiSource ? (applicant.api_skills || []).join('; ') : (applicant.profile?.skills || []).join('; '),
          getStatusDisplayName(applicant.status),
          new Date(applicant.applied_at).toLocaleDateString()
        ].map(field => `"${field}"`).join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `WFH_INDIA_${jobTitle}_applicants_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV downloaded successfully");
  };

  // PDF Export via Edge Function
  const exportAsPDF = async () => {
    const filteredApplicants = filterApplicants(activeTab);
    if (filteredApplicants.length === 0) {
      toast.error("No applicants to export");
      return;
    }

    const { data, config } = formatApplicantsForDownload(filteredApplicants, jobTitle);
    
    const success = await downloadViaEdgeFunction(
      'pdf',
      `WFH_INDIA_${jobTitle}_applicants_${new Date().toISOString().split('T')[0]}`,
      data,
      'applicants-list',
      config
    );

    if (!success) {
      // Fallback to local PDF
      fallbackExportPDF(filteredApplicants);
    }
  };

  const fallbackExportPDF = (filteredApplicants: any[]) => {
    const doc = new jsPDF();
    const domain = SITE_CONFIG.PRODUCTION_DOMAIN.replace('https://', '').replace('http://', '');
    
    // Brand name
    doc.setFontSize(12);
    doc.setTextColor(139, 92, 246);
    doc.text('WORKLY INDIA', 14, 12);
    
    // Job title
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text(`${jobTitle} - Applicants`, 14, 24);
    
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    doc.text(`Exported: ${new Date().toLocaleDateString()} | Total: ${filteredApplicants.length} applicants`, 14, 32);
    
    // Table headers
    let yPos = 45;
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(139, 92, 246);
    doc.rect(14, yPos - 6, 182, 10, 'F');
    doc.text('Name', 16, yPos);
    doc.text('Email', 50, yPos);
    doc.text('Phone', 100, yPos);
    doc.text('Status', 140, yPos);
    doc.text('Applied', 170, yPos);
    
    yPos += 10;
    doc.setTextColor(33, 37, 41);
    
    filteredApplicants.forEach((applicant, index) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      
      const isGuestOrApiSource = applicant.application_source === 'api' || !applicant.user_id;
      const name = (isGuestOrApiSource ? applicant.api_full_name : applicant.profile?.full_name) || 'N/A';
      const email = (isGuestOrApiSource ? applicant.api_email : applicant.profile?.email) || 'N/A';
      const phone = (isGuestOrApiSource ? applicant.api_phone : applicant.profile?.phone) || 'N/A';
      const status = getStatusDisplayName(applicant.status);
      const appliedDate = new Date(applicant.applied_at).toLocaleDateString();
      
      if (index % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(14, yPos - 5, 182, 8, 'F');
      }
      
      doc.setFontSize(9);
      doc.text(name.substring(0, 18), 16, yPos);
      doc.text(email.substring(0, 28), 50, yPos);
      doc.text(phone.substring(0, 15), 100, yPos);
      doc.text(status.substring(0, 15), 140, yPos);
      doc.text(appliedDate, 170, yPos);
      
      yPos += 8;
    });
    
    // Footer with correct domain
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Workly India - India's #1 Remote Jobs Platform | ${domain}`, 14, 285);
      doc.text(`Page ${i} of ${pageCount}`, 180, 285);
    }
    
    doc.save(`Workly_India_${jobTitle}_applicants_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF downloaded successfully");
  };

  // Google Sheets Export function - creates Google Sheet via API
  const exportToGoogleSheets = async () => {
    const filteredApplicants = filterApplicants(activeTab);
    if (filteredApplicants.length === 0) {
      toast.error("No applicants to export");
      return;
    }

    const loadingToast = toast.loading("Creating Google Sheet...");

    try {
      // Prepare applicant data for the edge function
      const applicantData = filteredApplicants.map(applicant => {
        const isGuestOrApiSource = applicant.application_source === 'api' || !applicant.user_id;
        return {
          name: isGuestOrApiSource ? (applicant.api_full_name || '') : (applicant.profile?.full_name || ''),
          email: isGuestOrApiSource ? (applicant.api_email || '') : (applicant.profile?.email || ''),
          phone: isGuestOrApiSource ? (applicant.api_phone || '') : (applicant.profile?.phone || ''),
          position: isGuestOrApiSource ? (applicant.api_current_position || '') : (applicant.profile?.current_position || ''),
          company: isGuestOrApiSource ? (applicant.api_company || '') : (applicant.profile?.company || ''),
          location: isGuestOrApiSource ? (applicant.api_location || '') : (applicant.profile?.location || ''),
          skills: isGuestOrApiSource ? (applicant.api_skills || []).join(', ') : (applicant.profile?.skills || []).join(', '),
          status: getStatusDisplayName(applicant.status),
          appliedDate: new Date(applicant.applied_at).toLocaleDateString()
        };
      });

      const { data, error } = await supabase.functions.invoke('export-to-sheets', {
        body: {
          applicants: applicantData,
          jobTitle: jobTitle
        }
      });

      toast.dismiss(loadingToast);

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create Google Sheet');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create Google Sheet');
      }

      // Open the created spreadsheet
      window.open(data.spreadsheetUrl, '_blank');
      toast.success("Google Sheet created successfully!");

    } catch (err: any) {
      toast.dismiss(loadingToast);
      console.error('Google Sheets export error:', err);
      toast.error("Google Sheets export failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => goBack(navigate, "/employer-portal")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const jobTitle = applicants[0]?.job?.title || "Job Position";
  const totalApplications = statusCounts.all;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "shortlisted":
        return "bg-green-100 text-green-800";
      case "interview_scheduled":
        return "bg-blue-100 text-blue-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "hired":
        return "bg-purple-100 text-purple-800";
      case "reviewed":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };


  const filterApplicants = (status: string) => {
    let filtered = applicants;
    
    if (status === "guest") {
      // Filter guest applications (no user_id)
      filtered = applicants.filter(applicant => !applicant.user_id);
    } else if (status !== "all") {
      filtered = applicants.filter(applicant => applicant.status.toLowerCase() === status);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(applicant => {
        const isApiSource = applicant.application_source === 'api';
        const name = isApiSource ? applicant.api_full_name : applicant.profile?.full_name;
        const position = isApiSource ? applicant.api_current_position : applicant.profile?.current_position;
        const email = isApiSource ? applicant.api_email : applicant.profile?.email;
        const phone = isApiSource ? applicant.api_phone : applicant.profile?.phone;
        const skills = isApiSource ? applicant.api_skills : applicant.profile?.skills;
        
        return name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone?.includes(searchTerm) ||
          skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
      });
    }

    // Apply additional filters
    if (experienceFilter !== "all") {
      filtered = filtered.filter(applicant => {
        const isApiSource = applicant.application_source === 'api';
        const exp = isApiSource ? (applicant.api_experience_years || 0) : (applicant.profile?.experience_years || 0);
        switch (experienceFilter) {
          case "0-1": return exp <= 1;
          case "2-5": return exp >= 2 && exp <= 5;
          case "6-10": return exp >= 6 && exp <= 10;
          case "10+": return exp > 10;
          default: return true;
        }
      });
    }

    if (locationFilter !== "all") {
      filtered = filtered.filter(applicant => {
        const isApiSource = applicant.application_source === 'api';
        const location = isApiSource ? applicant.api_location : applicant.profile?.location;
        return location?.toLowerCase().includes(locationFilter.toLowerCase());
      });
    }
    
    return filtered;
  };

  // Get unique locations for filter
  const getUniqueLocations = () => {
    const locations = applicants
      .map(applicant => {
        const isApiSource = applicant.application_source === 'api';
        return isApiSource ? applicant.api_location : applicant.profile?.location;
      })
      .filter(Boolean)
      .filter((location, index, self) => self.indexOf(location) === index);
    return locations;
  };

  const handleStatusUpdate = async (applicationId: string, newStatus: string) => {
    const success = await updateApplicationStatus(applicationId, newStatus);
    if (success) {
      toast.success(`Application status updated to ${getStatusDisplayName(newStatus)}`);
    } else {
      toast.error('Failed to update application status');
    }
  };

  // Update status to interview_scheduled only
  const handleScheduleInterviewClick = async (applicationId: string, newStatus: string) => {
    const success = await updateApplicationStatus(applicationId, newStatus);
    if (success) {
      toast.success(`Status updated to ${getStatusDisplayName(newStatus)}`);
    } else {
      toast.error('Failed to update application status');
    }
  };

  // Navigate to interview scheduling page with pre-selected applicant
  const handleGoToScheduling = (applicant: any) => {
    navigate(`/employer/interviews?jobId=${applicant.job_id}&applicantId=${applicant.user_id}&openDialog=true`);
  };

  const openProfileDialog = (applicant: any) => {
    setSelectedApplicant(applicant);
    setIsProfileDialogOpen(true);
  };

  const handleRefresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    window.location.reload();
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/employer-portal")}
                className="text-slate-600 hover:text-slate-900 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back to Jobs</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>
            <div className="text-center min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{jobTitle}</h1>
              <p className="text-xs sm:text-sm text-slate-500">{totalApplications} Applications</p>
            </div>
            <div className="w-16 sm:w-20"></div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">{/* Content continues */}
        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1 relative min-w-0">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search by name, email, phone, position, skills..."
                className="pl-10 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 sm:gap-4">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white z-50">
                  <DropdownMenuItem onClick={exportAsPDF} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2 text-red-600" />
                    <span>PDF Download</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsCSV} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                    <span>CSV Download</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToGoogleSheets} className="cursor-pointer">
                    <Table className="w-4 h-4 mr-2 text-blue-600" />
                    <span>Google Sheets</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Experience</label>
                  <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Any experience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any experience</SelectItem>
                      <SelectItem value="0-1">0-1 years</SelectItem>
                      <SelectItem value="2-5">2-5 years</SelectItem>
                      <SelectItem value="6-10">6-10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Location</label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Any location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any location</SelectItem>
                      {getUniqueLocations().map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setExperienceFilter("all");
                      setLocationFilter("all");
                      setSearchTerm("");
                    }}
                    className="text-sm"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 bg-slate-50 text-sm h-auto p-1 gap-1">
              <TabsTrigger 
                value="all" 
                className="px-4 py-3 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                All ({statusCounts.all})
              </TabsTrigger>
              <TabsTrigger 
                value="applied" 
                className="px-4 py-3 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Applied ({statusCounts.applied})
              </TabsTrigger>
              <TabsTrigger 
                value="shortlisted" 
                className="px-4 py-3 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Shortlisted ({statusCounts.shortlisted})
              </TabsTrigger>
              <TabsTrigger 
                value="interview_scheduled" 
                className="px-4 py-3 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Interview ({statusCounts.interview_scheduled})
              </TabsTrigger>
              <TabsTrigger 
                value="rejected" 
                className="px-4 py-3 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Rejected ({statusCounts.rejected})
              </TabsTrigger>
              <TabsTrigger 
                value="guest" 
                className="px-4 py-3 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Guest ({statusCounts.guest})
              </TabsTrigger>
            </TabsList>
            
            {/* Extra spacing after tabs */}
            <div className="h-4"></div>

            <TabsContent value={activeTab} className="space-y-4 mt-0">
              {filterApplicants(activeTab).map((applicant) => {
                // Always check api_* fields first, then fallback to profile.* fields
                const displayName = applicant.api_full_name || applicant.profile?.full_name || 'Applicant';
                const displayPosition = applicant.api_current_position || applicant.profile?.current_position;
                const displayCompany = applicant.api_company || applicant.profile?.company;
                const displayLocation = applicant.api_location || applicant.profile?.location;
                const displayPhone = applicant.api_phone || applicant.profile?.phone;
                const displaySkills = applicant.api_skills || applicant.profile?.skills;
                const displayProfileImage = applicant.profile?.profile_image_url;

                return (
                  <Card key={applicant.id} className="p-4 hover:shadow-lg transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary">
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <Avatar className="w-10 h-10 shrink-0">
                        {displayProfileImage ? (
                          <AvatarImage src={displayProfileImage} alt={displayName} />
                        ) : null}
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-medium text-sm">
                          {displayName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Name, Badge, Date, Actions - stacked vertically */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-slate-900 truncate">
                          {displayName}
                        </h3>
                        {!applicant.user_id ? (
                          <Badge className="text-xs mt-1 bg-gray-100 text-gray-800">
                            Guest
                          </Badge>
                        ) : (
                          <Badge className={`text-xs mt-1 ${getStatusColor(applicant.status)}`}>
                            {getStatusDisplayName(applicant.status)}
                          </Badge>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Applied {new Date(applicant.applied_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} {new Date(applicant.applied_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </p>
                        
                        {/* Actions - below time */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {/* Go to Scheduling Button */}
                          {applicant.application_source !== 'api' && applicant.status === 'interview_scheduled' && (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => handleGoToScheduling(applicant)}
                              className="text-xs"
                            >
                              <Calendar className="w-3 h-3 mr-1" />
                              Schedule
                            </Button>
                          )}
                          {/* Update Status - Hide for guest applications (user_id is null) */}
                          {user && applicant.user_id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="text-xs">
                                  Status
                                  <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="bg-popover z-50">
                                {applicant.status !== 'shortlisted' && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(applicant.id, 'shortlisted')}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                                    Shortlist
                                  </DropdownMenuItem>
                                )}
                                {applicant.status !== 'interview_scheduled' && (
                                  <DropdownMenuItem onClick={() => handleScheduleInterviewClick(applicant.id, 'interview_scheduled')}>
                                    <Calendar className="w-4 h-4 mr-2 text-purple-600" />
                                    Schedule Interview
                                  </DropdownMenuItem>
                                )}
                                {applicant.status !== 'rejected' && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(applicant.id, 'rejected')} className="text-red-600">
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject
                                  </DropdownMenuItem>
                                )}
                                {applicant.status !== 'hired' && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(applicant.id, 'hired')} className="text-green-600">
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Hire
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button 
                            size="sm" 
                            className="text-xs"
                            onClick={() => openProfileDialog(applicant)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          {applicant.resume_url && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadFileDirectly(applicant.resume_url!, `${applicant.profile?.full_name || applicant.api_full_name || 'Resume'}-CV.pdf`)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              CV
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
              );
              })}

              {filterApplicants(activeTab).length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    No applicants found
                  </h3>
                  <p className="text-slate-600">
                    {activeTab === "all" 
                      ? "No one has applied for this position yet." 
                      : `No applicants with ${getStatusDisplayName(activeTab)} status.`
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Dialogs */}
      {selectedApplicant && (
        <ApplicantProfileDialog 
          open={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
            applicant={{
              id: selectedApplicant.profile?.user_id || selectedApplicant.user_id,
              // Always check api_* fields first, then fallback to profile.* fields
              name: selectedApplicant.api_full_name || selectedApplicant.profile?.full_name || 'Unknown',
              phone: selectedApplicant.api_phone || selectedApplicant.profile?.phone || '',
              email: selectedApplicant.api_email || selectedApplicant.profile?.email || '',
              location: selectedApplicant.api_location || selectedApplicant.profile?.location || '',
              profileImage: selectedApplicant.profile?.profile_image_url || '',
              currentPosition: selectedApplicant.api_current_position || selectedApplicant.profile?.current_position || '',
              company: selectedApplicant.api_company || selectedApplicant.profile?.company || '',
              experience: selectedApplicant.api_experience_years?.toString() || selectedApplicant.profile?.experience_years?.toString() || '0',
              skills: selectedApplicant.api_skills || selectedApplicant.profile?.skills || [],
              education: selectedApplicant.profile?.education || '',
              appliedAt: selectedApplicant.applied_at || new Date().toISOString(),
              bio: selectedApplicant.api_bio || selectedApplicant.profile?.bio || '',
              experienceLevel: selectedApplicant.profile?.experience_level || 0,
              preferredLocation: selectedApplicant.profile?.preferred_location || '',
              jobType: selectedApplicant.profile?.job_type || '',
              industry: selectedApplicant.profile?.industry || '',
              whatsappNumber: selectedApplicant.api_whatsapp_number || selectedApplicant.profile?.whatsapp_number || '',
            application_source: selectedApplicant.application_source || 'website',
            isGuest: !selectedApplicant.user_id,
            api_social_links: selectedApplicant.api_social_links,
            api_certifications: selectedApplicant.api_certifications,
            api_professional_experiences: selectedApplicant.api_professional_experiences,
            api_education_entries: selectedApplicant.api_education_entries,
            socialLinks: {
              instagram: selectedApplicant.profile?.instagram_link || '',
              facebook: selectedApplicant.profile?.facebook_link || '',
              youtube: selectedApplicant.profile?.youtube_link || '',
              linkedin: selectedApplicant.profile?.linkedin_link || ''
            },
            address: {
              precise: selectedApplicant.profile?.precise_address || '',
              city: selectedApplicant.profile?.city || '',
              state: selectedApplicant.profile?.state || '',
              country: selectedApplicant.profile?.country || '',
              postalCode: selectedApplicant.profile?.postal_code || ''
            },
            languages: selectedApplicant.api_languages || selectedApplicant.profile?.languages || [],
            coverLetter: selectedApplicant.cover_letter || '',
            telegramUsername: selectedApplicant.telegramUsername || selectedApplicant.profile?.telegram_username || '',
              educationEntries: (() => {
                console.log('[DEBUG ViewApplicants] selectedApplicant:', selectedApplicant);
                console.log('[DEBUG ViewApplicants] educationEntries:', selectedApplicant.educationEntries);
                console.log('[DEBUG ViewApplicants] certifications:', selectedApplicant.certifications);
                console.log('[DEBUG ViewApplicants] professionalExperiences:', selectedApplicant.professionalExperiences);
                return selectedApplicant.educationEntries || [];
              })(),
              certifications: selectedApplicant.certifications || [],
              professionalExperiences: selectedApplicant.professionalExperiences || []
          }}
        />
      )}
      </div>
    </div>
  );
};

export default ViewApplicants;