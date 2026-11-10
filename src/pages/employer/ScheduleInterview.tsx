import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { ScheduleInterviewDialog } from "@/components/ScheduleInterviewDialog";
import { useInterviews } from "@/hooks/useInterviews";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ScheduleInterview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [preSelectedJob, setPreSelectedJob] = useState<string | undefined>();
  const [preSelectedApplicant, setPreSelectedApplicant] = useState<string | undefined>();
  
  const { scheduleInterview } = useInterviews();

  useEffect(() => {
    fetchJobsAndApplicants();
    
    // Get pre-selected values from URL params
    const jobId = searchParams.get('jobId');
    const applicantId = searchParams.get('applicantId');
    
    if (jobId) setPreSelectedJob(jobId);
    if (applicantId) setPreSelectedApplicant(applicantId);
  }, [searchParams]);

  const fetchJobsAndApplicants = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      // Fetch employer's jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select(`
          id, 
          title, 
          company_id,
          companies!inner(user_id)
        `)
        .eq('status', 'active')
        .eq('companies.user_id', userId);
      
      // Fetch active interviews
      const { data: activeInterviews } = await supabase
        .from('interviews')
        .select('job_id')
        .in('status', ['scheduled', 'in_progress', 'rescheduled']);
      
      const activeInterviewJobIds = new Set(activeInterviews?.map(i => i.job_id) || []);
      
      const jobsWithLockStatus = jobsData?.map(job => ({
        ...job,
        hasActiveInterview: activeInterviewJobIds.has(job.id)
      })) || [];
      
      if (jobsWithLockStatus) setJobs(jobsWithLockStatus);

      // Fetch applicants
      const allApplicants: any[] = [];
      
      if (jobsData && jobsData.length > 0) {
        for (const job of jobsData) {
          try {
            const { data: applicantsData } = await supabase
              .rpc('get_job_applicants_with_emails', { p_job_id: job.id });
            
            if (applicantsData && applicantsData.length > 0) {
              const formattedApplicants = applicantsData
                .filter(app => ['shortlisted', 'interview_scheduled', 'interview'].includes(String(app.status || '').toLowerCase()))
                .map((app: any) => ({
                  id: app.user_id,
                  full_name: app.full_name || 'Unknown',
                  job_id: job.id
                }));
              
              allApplicants.push(...formattedApplicants);
            }
          } catch (err) {
            console.error(`Error fetching applicants for job ${job.id}:`, err);
          }
        }
      }
      
      setApplicants(allApplicants);
    } catch (error) {
      console.error('Error fetching jobs and applicants:', error);
      toast.error('Failed to load data');
    }
  };

  const handleScheduleInterview = async (data: any) => {
    const success = await scheduleInterview(
      data.jobId,
      data.applicantId,
      data.scheduledAt,
      data.mode,
      data.locationUrl,
      data.notes,
      data.scheduledEndAt,
      data.videoPlatform
    );
    
    if (success) {
      toast.success('Interview scheduled successfully!');
      navigate('/employer/interviews');
    }
    
    return success;
  };

  const handleDialogClose = (open: boolean) => {
    setScheduleDialogOpen(open);
    if (!open) {
      navigate('/employer/interviews');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/employer/interviews')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Interviews
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Schedule Interview</h1>
            </div>
          </div>
        </Card>

        <ScheduleInterviewDialog
          open={scheduleDialogOpen}
          onOpenChange={handleDialogClose}
          onSchedule={handleScheduleInterview}
          jobs={jobs}
          applicants={applicants}
          preSelectedJob={preSelectedJob}
          preSelectedApplicant={preSelectedApplicant}
        />
      </div>
    </div>
  );
};

export default ScheduleInterview;
