import React, { useState, useEffect } from "react";
import { downloadFileDirectly } from "@/utils/downloadFile";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Filter, 
  Users, 
  Search, 
  Eye,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Download,
  AlertCircle
} from "lucide-react";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useApplicantNotifications } from "@/hooks/useApplicantNotifications";
import { useWakeRefetch } from "@/hooks/useWakeRefetch";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Applicant {
  id: string;
  job_id: string;
  applicant_id: string;
  applied_at: string;
  status: string;
  cover_letter?: string;
  resume_url?: string;
  job: {
    id: string;
    title: string;
    company_id: string;
  };
  profile?: {
    full_name?: string;
    phone?: string;
    location?: string;
    current_position?: string;
    company?: string;
    skills?: string[];
    profile_image_url?: string;
  };
}

const AllApplicants = () => {
  const navigate = useNavigate();
  const { user, company } = useEmployerAuth();
  const { markApplicantNotificationsAsRead } = useApplicantNotifications();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user && company) {
      fetchAllApplicants();
      // Mark applicant notifications as read when viewing this page
      markApplicantNotificationsAsRead();
    } else if (!loading) {
      setError("Please complete your company profile to view applicants");
    }
  }, [user, company, loading]);

  // Refetch when tab becomes visible again after mobile screen off/on
  useWakeRefetch(() => { if (user && company) fetchAllApplicants(); }, !!(user && company));


  const fetchAllApplicants = async () => {
    if (!user || !company?.id) {
      setError("User not authenticated or company not found");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, get all jobs for this company
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, company_id')
        .eq('company_id', company.id);

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        throw new Error('Failed to fetch company jobs');
      }

      if (!jobs || jobs.length === 0) {
        setApplicants([]);
        setLoading(false);
        return;
      }

      const jobIds = jobs.map(job => job.id);

      // Fetch all applications for these jobs
      const { data: applications, error: applicationsError } = await supabase
        .from('job_applications')
        .select('*')
        .in('job_id', jobIds)
        .order('applied_at', { ascending: false });

      if (applicationsError) {
        console.error('Error fetching applications:', applicationsError);
        throw new Error('Failed to fetch applications');
      }

      if (!applications || applications.length === 0) {
        setApplicants([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all applicants
      const userIds = applications.map(app => app.applicant_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          phone,
          location,
          current_position,
          company,
          skills,
          profile_image_url
        `)
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Don't throw error here, just continue without profiles
      }

      // Create profiles lookup map
      const profilesMap = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {} as Record<string, any>);

      // Create jobs lookup map
      const jobsMap = jobs.reduce((acc, job) => {
        acc[job.id] = job;
        return acc;
      }, {} as Record<string, any>);

      // Combine data
      const formattedApplicants: Applicant[] = applications.map(app => ({
        ...app,
        job: jobsMap[app.job_id],
        profile: profilesMap[app.applicant_id] || null
      }));

      setApplicants(formattedApplicants);
    } catch (err) {
      console.error('Error in fetchAllApplicants:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };

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

  const filteredApplicants = applicants.filter(applicant => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      applicant.profile?.full_name?.toLowerCase().includes(searchLower) ||
      applicant.profile?.current_position?.toLowerCase().includes(searchLower) ||
      applicant.job?.title?.toLowerCase().includes(searchLower) ||
      applicant.profile?.skills?.some(skill => 
        skill.toLowerCase().includes(searchLower)
      )
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading applicants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to load data</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={fetchAllApplicants} className="w-full">
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate("/employer-portal")}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    await fetchAllApplicants();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-900">All Applicants</h1>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
            <Input
              placeholder="Search applicants by name, position, job title, or skills..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-slate-600">
            {filteredApplicants.length} applicant{filteredApplicants.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Applicants List */}
        <div className="space-y-4">
          {filteredApplicants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {applicants.length === 0 ? "No applications yet" : "No applicants found"}
              </h3>
              <p className="text-slate-600">
                {applicants.length === 0 
                  ? "No one has applied for your jobs yet." 
                  : "Try adjusting your search terms."
                }
              </p>
            </div>
          ) : (
            filteredApplicants.map((applicant) => (
              <Card key={applicant.id} className="p-6 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start space-x-4">
                  <Avatar className="w-12 h-12 shrink-0">
                    {applicant.profile?.profile_image_url ? (
                      <AvatarImage 
                        src={applicant.profile.profile_image_url} 
                        alt={applicant.profile?.full_name || 'Applicant'} 
                      />
                    ) : null}
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                      {applicant.profile?.full_name?.substring(0, 2).toUpperCase() || 'AP'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg text-slate-900 truncate">
                          {applicant.profile?.full_name || 'Applicant'}
                        </h3>
                        <p className="text-slate-600 text-sm truncate">
                          Applied for: <span className="font-medium">{applicant.job?.title}</span>
                        </p>
                        <p className="text-slate-600 text-sm truncate">
                          {applicant.profile?.current_position} 
                          {applicant.profile?.company && ` at ${applicant.profile.company}`}
                        </p>
                      </div>
                      <Badge className={`shrink-0 ${getStatusColor(applicant.status)}`}>
                        {applicant.status}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
                      {applicant.profile?.location && (
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          <span>{applicant.profile.location}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>Applied {new Date(applicant.applied_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {applicant.profile?.skills && applicant.profile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {applicant.profile.skills.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {applicant.profile.skills.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{applicant.profile.skills.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        onClick={() => navigate(`/job/${applicant.job_id}/applicants`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Contact
                      </Button>
                      {applicant.resume_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadFileDirectly(applicant.resume_url!, `${applicant.profile?.full_name || 'Resume'}-CV.pdf`)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Resume
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        </div>
    </div>
  );
};

export default AllApplicants;