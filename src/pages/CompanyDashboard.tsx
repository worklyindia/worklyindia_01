
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  BarChart3, 
  Users,
  Calendar,
  MapPin,
  Clock,
  Building,
  Bell,
  Menu
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { useApplicantNotifications } from "@/hooks/useApplicantNotifications";
import { useAnimatedPlaceholder, searchPlaceholders } from "@/hooks/useAnimatedPlaceholder";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { newApplicantCount, markApplicantNotificationsAsRead } = useApplicantNotifications();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("jobs");
  const animatedPlaceholder = useAnimatedPlaceholder(searchPlaceholders);

  // Mock data for job postings
  const jobPostings = [
    {
      id: 1,
      title: "YouTube video editor download",
      department: "engineering",
      location: "Remote",
      type: "Full-time",
      status: "active",
      applications: 0,
      views: 0,
      shortlisted: 8,
      postedDate: "31/08/2025",
      created_at: "2025-08-31T00:00:00Z",
      expires_at: "2025-09-30T00:00:00Z"
    },
    {
      id: 2,
      title: "Job india",
      department: "sales",
      location: "Mumbai",
      type: "Full-time", 
      status: "active",
      applications: 0,
      views: 0,
      shortlisted: 8,
      postedDate: "31/08/2025",
      created_at: "2025-08-31T00:00:00Z",
      expires_at: "2025-09-30T00:00:00Z"
    }
  ];

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

  const filteredJobs = jobPostings.filter(job =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-border sticky top-0 z-50">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <Button variant="ghost" className="lg:hidden p-2 relative">
                <Menu className="h-4 w-4" />
                {newApplicantCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  </span>
                )}
              </Button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                <Building className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">HirePortal</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Employer Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
              <Button variant="ghost" className="relative p-2">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></span>
              </Button>
              <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                <SafeAvatarImage
                  src={normalizeImageUrl(user?.user_metadata?.avatar_url || user?.user_metadata?.logo_url)}
                  alt="Profile"
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs sm:text-sm font-medium">
                  {user?.user_metadata?.company_name?.substring(0, 2).toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || "WF"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Page Header */}
        <div className="flex flex-col space-y-3 sm:space-y-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Job Postings</h2>
              <p className="text-muted-foreground text-sm sm:text-base mt-1">Manage your job listings and track applications</p>
            </div>
            <Button 
              onClick={() => navigate('/post-job')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 shrink-0"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post New Job
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder={animatedPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="shrink-0">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Job Listings */}
        <div className="space-y-4 sm:space-y-6">
          {filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <Building className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">No jobs found</h3>
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                  {searchTerm ? "Try adjusting your search criteria" : "Start by posting your first job"}
                </p>
                <Button onClick={() => navigate('/post-job')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Post New Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4 sm:space-y-6">
                    {/* Job Header */}
                    <div className="flex flex-col space-y-3 sm:space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 sm:gap-3 mb-2">
                            <h3 className="text-base sm:text-xl font-semibold text-foreground leading-tight flex-1 min-w-0">{job.title}</h3>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {job.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                              {job.department}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                              {job.postedDate}
                            </span>
                            {(() => {
                              const expiryInfo = getExpiryInfo(job);
                              return (
                                <span className={`flex items-center gap-1 ${
                                  expiryInfo.isExpired ? 'text-red-600' : 
                                  expiryInfo.isExpiringSoon ? 'text-orange-600' : 
                                  'text-muted-foreground'
                                }`}>
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                  {expiryInfo.isExpired ? 'Expired' : 
                                   `Expires ${expiryInfo.expiryDate} (${expiryInfo.daysLeft} days left)`}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 sm:gap-6 py-4 sm:py-6 border-t border-b border-border">
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-primary">{job.applications}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">Applications</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-primary">{job.views}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">Views</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-green-600">{job.shortlisted}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">Shortlisted</div>
                      </div>
                    </div>

                    {/* Actions - Mobile First with Icons */}
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          markApplicantNotificationsAsRead();
                          navigate(`/job/${job.id}/applicants`);
                        }}
                        className="w-full sm:w-auto text-xs sm:text-sm relative"
                      >
                        <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden xs:inline">View </span>Applicants
                        {newApplicantCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                            {newApplicantCount > 9 ? '9+' : newApplicantCount}
                          </span>
                        )}
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/employer/edit-job/${job.id}`)}
                        className="w-full sm:w-auto text-xs sm:text-sm"
                      >
                        <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Edit<span className="hidden xs:inline"> Job</span>
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/employer/analytics/${job.id}`)}
                        className="w-full sm:w-auto text-xs sm:text-sm"
                      >
                        <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Analytics
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        className="w-full sm:w-auto text-xs sm:text-sm"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default CompanyDashboard;
