import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type InterviewPhase = 'upcoming' | 'live' | 'ended';

export interface JobApplicationData {
  id: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  appliedDate: string;
  status: string;
  statusColor: string;
  salary: string;
  companyLogoUrl?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWhatsapp?: string;
  interview?: {
    id: string;
    scheduledAt: string;
    scheduledEndAt?: string;
    mode: string;
    locationUrl?: string;
    status: string;
    notes?: string;
    interviewPhase?: InterviewPhase;
    video_platform?: string;
  };
}

export const useJobApplications = () => {
  const [applications, setApplications] = useState<JobApplicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const { user } = useAuth();

  // Get current server time with offset
  const getCurrentServerTime = () => {
    return new Date(Date.now() + serverTimeOffset);
  };

  // Calculate interview phase based on current time
  const getInterviewPhase = (scheduledAt: string, scheduledEndAt?: string): InterviewPhase => {
    const now = getCurrentServerTime();
    const startTime = new Date(scheduledAt);
    const endTime = scheduledEndAt 
      ? new Date(scheduledEndAt) 
      : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 60 minutes

    if (now < startTime) return 'upcoming';
    if (now >= startTime && now < endTime) return 'live';
    return 'ended';
  };

  // Sync server time offset
  useEffect(() => {
    const syncServerTime = async () => {
      try {
        const { data } = await supabase.rpc('get_server_time');
        if (data) {
          const serverTime = new Date(data).getTime();
          const clientTime = Date.now();
          setServerTimeOffset(serverTime - clientTime);
        }
      } catch (error) {
        console.warn('Failed to sync server time:', error);
      }
    };

    syncServerTime();
  }, []);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!user) {
        setApplications([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch user's job applications 
        const { data: applications, error } = await supabase
          .from('job_applications')
          .select('id, job_id, applicant_id, applied_at, status, cover_letter, resume_url, reviewed_at')
          .eq('applicant_id', user.id)
          .order('applied_at', { ascending: false });

        if (error) throw error;

        // Get job details for each application using the secure function
        const applicationsWithJobs = [];
        
        for (const app of applications || []) {
          const { data: jobData, error: jobError } = await supabase
            .rpc('get_job_for_application', { p_job_id: app.job_id });
          
          if (!jobError && jobData && jobData.length > 0) {
            applicationsWithJobs.push({
              ...app,
              job: jobData[0]
            });
          }
        }

        // Batch fetch company details for logos and contact info
        const companyIds = [...new Set(applicationsWithJobs.map(app => app.job?.company_id).filter(Boolean))];
        let companyDetailsMap: Record<string, any> = {};
        if (companyIds.length > 0) {
          const { data: companies } = await supabase
            .from('companies')
            .select('id, logo_url, phone, email, whatsapp_number')
            .in('id', companyIds);
          if (companies) {
            companyDetailsMap = Object.fromEntries(companies.map(c => [c.id, c]));
          }
        }

        // Get interviews for this user's applications
        const applicationIds = applicationsWithJobs.map(app => app.id);
        let interviewsData = [];
        
        if (applicationIds.length > 0) {
          const { data: interviews, error: interviewsError } = await supabase
            .from('interviews')
            .select('id, job_id, applicant_id, scheduled_at, scheduled_end_at, mode, location_url, status, notes, video_platform')
            .eq('applicant_id', user.id)
            .in('job_id', applicationsWithJobs.map(app => app.job_id));
          
          if (interviewsError) {
            console.warn('Error fetching interviews:', interviewsError);
          } else {
            interviewsData = interviews || [];
          }
        }

        const formattedApplications: JobApplicationData[] = applicationsWithJobs.map((app: any) => {
          const getStatusColor = (status: string) => {
            switch (status.toLowerCase()) {
              case 'applied':
                return 'bg-blue-500';
              case 'under review':
              case 'reviewed':
                return 'bg-yellow-500';
              case 'shortlisted':
              case 'interview_scheduled':
                return 'bg-blue-500';
              case 'rejected':
                return 'bg-red-500';
              case 'hired':
                return 'bg-green-500';
              default:
                return 'bg-gray-500';
            }
          };

          const formatStatus = (status: string) => {
            switch (status.toLowerCase()) {
              case 'applied':
                return 'Applied';
              case 'reviewed':
                return 'Under Review';
              case 'shortlisted':
                return 'Shortlisted';
              case 'interview_scheduled':
                return 'Interview Scheduled';
              case 'rejected':
                return 'Rejected';
              case 'hired':
                return 'Hired';
              default:
                return status;
            }
          };

          // Find interview for this job
          const jobInterview = interviewsData.find((interview: any) => interview.job_id === app.job_id);
          const job = app.job;
          const companyDetails = companyDetailsMap[job?.company_id] || {};

          return {
            id: app.id,
            jobId: app.job_id,
            title: job?.title || 'Job Title',
            company: job?.company_name || 'Company',
            location: job?.location || 'Location',
            appliedDate: app.applied_at,
            status: formatStatus(app.status),
            statusColor: getStatusColor(app.status),
            salary: 'Contact for salary details',
            companyLogoUrl: companyDetails.logo_url || undefined,
            companyPhone: companyDetails.phone || undefined,
            companyEmail: companyDetails.email || undefined,
            companyWhatsapp: companyDetails.whatsapp_number || undefined,
            interview: jobInterview ? {
              id: jobInterview.id,
              scheduledAt: jobInterview.scheduled_at,
              scheduledEndAt: jobInterview.scheduled_end_at,
              mode: jobInterview.mode,
              locationUrl: jobInterview.location_url,
              status: jobInterview.status,
              notes: jobInterview.notes,
              interviewPhase: getInterviewPhase(jobInterview.scheduled_at, jobInterview.scheduled_end_at),
              video_platform: jobInterview.video_platform
            } : undefined
          };
        });

        setApplications(formattedApplications);
      } catch (err) {
        console.error('Error fetching job applications:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch applications');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [user]);

  const getStats = () => {
    const totalApplied = applications.length;
    const underReview = applications.filter(app => 
      app.status === 'Under Review' || app.status === 'Shortlisted'
    ).length;
    const interviews = applications.filter(app => 
      app.status === 'Interview Scheduled'
    ).length;
    const hired = applications.filter(app => 
      app.status === 'Hired'
    ).length;

    return {
      totalApplied,
      underReview,
      interviews,
      hired
    };
  };

  return {
    applications,
    loading,
    error,
    stats: getStats()
  };
};