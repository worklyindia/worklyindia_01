import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Search, User, Building2, Briefcase, Calendar,
  Mail, Phone, FileText, MessageSquare, RefreshCw, X,
  Eye, Edit, ExternalLink, CheckCircle, Clock, AlertCircle
} from "lucide-react";
import { useUniversalProfileLookup, LookupType } from "@/hooks/useUniversalProfileLookup";
import WebsiteUserCard from "@/components/owner-portal/WebsiteUserCard";
import EnhancedEmployerCard from "@/components/owner-portal/EnhancedEmployerCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const searchTypeLabels: Record<LookupType, { label: string; icon: any; placeholder: string }> = {
  phone: { label: "Phone", icon: Phone, placeholder: "Enter phone number..." },
  email: { label: "Email", icon: Mail, placeholder: "Enter email address..." },
  name: { label: "Name", icon: User, placeholder: "Enter name..." },
  user_id: { label: "User ID", icon: FileText, placeholder: "Enter user ID (UUID)..." }
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  in_progress: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
};

export default function UniversalLookupPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAdminStatus();
  const [inputValue, setInputValue] = useState("");
  const [selectedType, setSelectedType] = useState<LookupType | 'auto'>('auto');
  
  const {
    results,
    loading,
    error,
    searchQuery,
    searchType,
    searchProfiles,
    clearResults,
    detectSearchType
  } = useUniversalProfileLookup();

  const totalResults = 
    results.websiteUsers.length + 
    results.employers.length + 
    results.applications.length + 
    results.jobPostings.length + 
    results.interviews.length +
    results.supportTickets.length;

  const handleSearch = () => {
    if (!inputValue.trim()) return;
    const type = selectedType === 'auto' ? undefined : selectedType;
    searchProfiles(inputValue.trim(), type);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setInputValue("");
    clearResults();
  };

  const detectedType = inputValue.trim() ? detectSearchType(inputValue.trim()) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-primary/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Universal Profile Lookup</h1>
            <p className="text-xs text-primary-foreground/80">
              Search by Phone, Email, Name, or User ID
            </p>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="p-4 space-y-4">
        {/* Search Type Selector */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedType === 'auto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('auto')}
            className="text-xs"
          >
            Auto Detect
          </Button>
          {(Object.keys(searchTypeLabels) as LookupType[]).map((type) => {
            const { label, icon: Icon } = searchTypeLabels[type];
            return (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
                className="text-xs"
              >
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedType === 'auto' 
                ? "Enter phone, email, name, or user ID..." 
                : searchTypeLabels[selectedType]?.placeholder}
              className="pl-10 pr-10"
            />
            {inputValue && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={!inputValue.trim() || loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LottieSearchIcon size={16} />}
          </Button>
        </div>

        {/* Auto-detect indicator */}
        {selectedType === 'auto' && detectedType && inputValue.trim() && (
          <p className="text-xs text-muted-foreground">
            Detected search type: <Badge variant="outline" className="ml-1">{searchTypeLabels[detectedType].label}</Badge>
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {/* Results */}
        {!loading && searchQuery && (
          <div className="space-y-4">
            {/* Results Summary */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found <strong>{totalResults}</strong> results for "{searchQuery}"
              </p>
              <Badge variant="outline">{searchTypeLabels[searchType].label} Search</Badge>
            </div>

            {totalResults === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <span className="mx-auto mb-4 opacity-50 inline-flex"><LottieSearchIcon size={48} /></span>
                  <h3 className="font-medium mb-2">No Results Found</h3>
                  <p className="text-sm text-muted-foreground">
                    Try a different search term or search type
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="profiles" className="w-full">
                <TabsList className="w-full grid grid-cols-5 h-auto p-1">
                  <TabsTrigger value="profiles" className="text-xs py-2 flex flex-col gap-1">
                    <User className="h-4 w-4" />
                    <span>Users ({results.websiteUsers.length + results.employers.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="applications" className="text-xs py-2 flex flex-col gap-1">
                    <FileText className="h-4 w-4" />
                    <span>Apps ({results.applications.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="jobs" className="text-xs py-2 flex flex-col gap-1">
                    <Briefcase className="h-4 w-4" />
                    <span>Jobs ({results.jobPostings.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="interviews" className="text-xs py-2 flex flex-col gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Int ({results.interviews.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="text-xs py-2 flex flex-col gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>Tickets ({results.supportTickets.length})</span>
                  </TabsTrigger>
                </TabsList>

                {/* Profiles Tab */}
                <TabsContent value="profiles" className="mt-4 space-y-4">
                  {results.websiteUsers.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <User className="h-5 w-5 text-green-600" />
                        Job Seekers ({results.websiteUsers.length})
                      </h3>
                      <div className="space-y-3">
                        {results.websiteUsers.map((user) => (
                          <Card key={user.user_id} className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                  {user.profile_image_url ? (
                                    <img referrerPolicy="no-referrer" loading="lazy" decoding="async" src={user.profile_image_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <User className="h-6 w-6 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold truncate">{user.full_name || 'No Name'}</h4>
                                  <p className="text-sm text-muted-foreground truncate">{user.current_position || 'No Position'}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {user.email && (
                                      <Badge variant="outline" className="text-xs">
                                        <Mail className="h-3 w-3 mr-1" />{user.email}
                                      </Badge>
                                    )}
                                    {user.phone && (
                                      <Badge variant="outline" className="text-xs">
                                        <Phone className="h-3 w-3 mr-1" />{user.phone}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge className={cn("text-xs", statusColors[user.account_status] || statusColors.active)}>
                                      {user.account_status || 'active'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Joined {format(new Date(user.created_at), 'dd MMMM yyyy')}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/owner-portal/whatsapp/contact/${encodeURIComponent(user.phone || user.user_id)}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.employers.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        Employers ({results.employers.length})
                      </h3>
                      <div className="space-y-3">
                        {results.employers.map((employer) => (
                          <Card key={employer.user_id} className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                  {employer.logo_url ? (
                                    <img referrerPolicy="no-referrer" loading="lazy" decoding="async" src={employer.logo_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <Building2 className="h-6 w-6 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold truncate">{employer.company_name}</h4>
                                    {employer.is_verified && (
                                      <CheckCircle className="h-4 w-4 text-blue-500" />
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">{employer.industry || 'No Industry'}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {employer.email && (
                                      <Badge variant="outline" className="text-xs">
                                        <Mail className="h-3 w-3 mr-1" />{employer.email}
                                      </Badge>
                                    )}
                                    {employer.phone && (
                                      <Badge variant="outline" className="text-xs">
                                        <Phone className="h-3 w-3 mr-1" />{employer.phone}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {employer.total_jobs} Jobs ({employer.active_jobs} Active)
                                    </Badge>
                                    <Badge className={cn("text-xs", statusColors[employer.account_status] || statusColors.active)}>
                                      {employer.account_status || 'active'}
                                    </Badge>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/owner-portal/whatsapp/contact/${encodeURIComponent(employer.phone || employer.user_id)}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Applications Tab */}
                <TabsContent value="applications" className="mt-4">
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-3">
                      {results.applications.map((app) => (
                        <Card key={app.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold">{app.job_title}</h4>
                                <p className="text-sm text-muted-foreground">{app.company_name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Applied {format(new Date(app.applied_at), 'dd MMMM yyyy')}
                                </p>
                              </div>
                              <Badge className={cn("text-xs", statusColors[app.status] || statusColors.pending)}>
                                {app.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {results.applications.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No applications found</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Jobs Tab */}
                <TabsContent value="jobs" className="mt-4">
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-3">
                      {results.jobPostings.map((job) => (
                        <Card key={job.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold">{job.title}</h4>
                                <p className="text-sm text-muted-foreground">{job.company_name}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span>{job.applications_count} Applications</span>
                                  <span>{job.views_count} Views</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge className={cn("text-xs", statusColors[job.status] || statusColors.active)}>
                                  {job.status}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(job.created_at), 'dd MMMM')}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {results.jobPostings.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No job postings found</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Interviews Tab */}
                <TabsContent value="interviews" className="mt-4">
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-3">
                      {results.interviews.map((interview) => (
                        <Card key={interview.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold">{interview.job_title}</h4>
                                <p className="text-sm text-muted-foreground">{interview.company_name}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">
                                    {format(new Date(interview.scheduled_at), 'dd MMMM yyyy, hh:mm a')}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge className={cn("text-xs", statusColors[interview.status] || statusColors.scheduled)}>
                                  {interview.status}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {interview.interview_type}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {results.interviews.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No interviews found</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Support Tickets Tab */}
                <TabsContent value="tickets" className="mt-4">
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-3">
                      {results.supportTickets.map((ticket) => (
                        <Card key={ticket.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold">{ticket.title}</h4>
                                <p className="text-sm text-muted-foreground">{ticket.category}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(ticket.created_at), 'dd MMMM yyyy')}
                                </p>
                              </div>
                              <div className="text-right space-y-1">
                                <Badge className={cn("text-xs", statusColors[ticket.status] || statusColors.open)}>
                                  {ticket.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs block">
                                  {ticket.priority}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {results.supportTickets.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No support tickets found</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        {/* Initial State */}
        {!loading && !searchQuery && (
          <Card>
            <CardContent className="py-12 text-center">
              <span className="mx-auto mb-4 opacity-50 inline-flex"><LottieSearchIcon size={64} /></span>
              <h3 className="font-semibold text-lg mb-2">Universal Profile Lookup</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Search for any user by phone number, email, name, or user ID. 
                View their complete profile, applications, job postings, interviews, and support tickets.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-6 max-w-sm mx-auto text-left">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-green-600" />
                  <span>Phone Search</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span>Email Search</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-purple-600" />
                  <span>Name Search</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-orange-600" />
                  <span>User ID Search</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
