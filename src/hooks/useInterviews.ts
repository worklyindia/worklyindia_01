import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerTelegramEvent } from '@/hooks/useTelegramTrigger';
import { triggerWhatsAppEvent } from '@/hooks/useWhatsAppTrigger';
import { FirebasePushService } from '@/services/FirebasePushService';

export interface Interview {
  id: string;
  job_id: string;
  applicant_id: string;
  scheduled_at: string;
  scheduled_end_at?: string;
  mode: string;
  location_url?: string;
  daily_room_url?: string | null;
  daily_room_name?: string | null;
  host_meeting_token?: string | null;
  participant_meeting_tokens?: Record<string, string> | null;
  jitsi_room_name?: string | null;
  jitsi_meeting_url?: string | null;
  jitsi_password?: string | null;
  videosdk_room_id?: string | null;
  videosdk_meeting_url?: string | null;
  videosdk_host_token?: string | null;
  videosdk_participant_tokens?: Record<string, string> | null;
  hms_room_id?: string | null;
  hms_room_url?: string | null;
  hms_host_token?: string | null;
  hms_participant_tokens?: Record<string, string> | null;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  job?: {
    title: string;
  };
  applicant?: {
    full_name?: string;
    phone?: string;
    location?: string;
    current_position?: string;
    profile_image_url?: string;
  };
}

export const useInterviews = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchInterviews();
    }
  }, [user]);

  const fetchInterviews = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Use the new RPC function for secure interview fetching
      const { data: interviewsData, error: interviewsError } = await supabase
        .rpc('get_company_interviews');

      if (interviewsError) throw interviewsError;

      const formattedInterviews = (interviewsData || []).map((interview: any) => ({
        ...interview,
        job: { title: interview.job_title || 'Job' },
        applicant: {
          full_name: interview.applicant_full_name,
          phone: interview.applicant_phone,
          location: interview.applicant_location,
          current_position: interview.applicant_current_position,
          profile_image_url: interview.applicant_profile_image_url
        }
      }));

      setInterviews(formattedInterviews);
    } catch (err) {
      console.error('Error fetching interviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch interviews');
    } finally {
      setLoading(false);
    }
  };

  const scheduleInterview = async (
    jobId: string, 
    applicantId: string, 
    scheduledAt: string, 
    mode: string, 
    locationUrl?: string, 
    notes?: string,
    scheduledEndAt?: string,
    videoPlatform?: string
  ) => {
    try {
      // Create the interview record
      const { data: interviewData, error: interviewError } = await (supabase as any)
        .from('interviews')
        .insert({
          job_id: jobId,
          applicant_id: applicantId,
          scheduled_at: scheduledAt,
          scheduled_end_at: scheduledEndAt,
          mode,
          location_url: locationUrl,
          video_platform: mode === 'online' ? videoPlatform : null,
          notes,
          status: 'scheduled',
          host_user_id: user?.id
        })
        .select()
        .single();

      if (interviewError) throw interviewError;

      // Get job and applicant details for notifications
      const [jobResult, applicantResult, companyResult] = await Promise.all([
        supabase.from('jobs').select('title, company_id').eq('id', jobId).single(),
        supabase.from('profiles').select('full_name, user_id').eq('user_id', applicantId).single(),
        supabase.from('companies').select('company_name, user_id').eq('user_id', user?.id).single()
      ]);

      const jobTitle = jobResult.data?.title || 'Job';
      const applicantName = applicantResult.data?.full_name || 'Applicant';
      const companyName = companyResult.data?.company_name || 'Company';

      // Format date and time
      const dateObj = new Date(scheduledAt);
      const date = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const time = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // Get applicant phone for WhatsApp
      const { data: applicantPhone } = await supabase
        .from('profiles')
        .select('phone, whatsapp_number')
        .eq('user_id', applicantId)
        .single();

      const phone = applicantPhone?.whatsapp_number || applicantPhone?.phone;

      // Send Telegram notification to applicant (Job Seeker)
      triggerTelegramEvent('interview_scheduled', applicantId, 'user', applicantName, {
        job_title: jobTitle,
        company_name: companyName,
        date,
        time,
        mode: mode || 'Video'
      });

      // Send WhatsApp notification to applicant
      if (phone) {
        triggerWhatsAppEvent('interview_scheduled', phone, applicantName, {
          job_title: jobTitle,
          company_name: companyName,
          date,
          time,
          mode: mode || 'Video'
        });
      }

      // Push to the applicant is sent server-side by the interview database
      // trigger using the owner's interview_status_update template (logo +
      // single button). Sending it here as well produced duplicates.


      console.log('✅ Interview scheduled - applicant notifications sent');

      // Update the job application status to "interview_scheduled"
      const { error: applicationError } = await (supabase as any)
        .from('job_applications')
        .update({ status: 'interview_scheduled' })
        .eq('job_id', jobId)
        .eq('user_id', applicantId);

      if (applicationError) {
        console.warn('Failed to update application status:', applicationError);
      }

      // Refetch interviews to get updated data
      await fetchInterviews();
      return true;
    } catch (err) {
      console.error('Error scheduling interview:', err);
      return false;
    }
  };

  const updateInterviewStatus = async (interviewId: string, status: string, notes?: string) => {
    try {
      // Get interview details first for notifications
      const { data: interview } = await supabase
        .from('interviews')
        .select('applicant_id, job_id, scheduled_at, mode')
        .eq('id', interviewId)
        .single();

      const { error } = await (supabase as any)
        .from('interviews')
        .update({ 
          status,
          notes: notes || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', interviewId);

      if (error) throw error;

      // Send Telegram notifications for status changes
      if (interview) {
        const [jobResult, applicantResult, companyResult] = await Promise.all([
          supabase.from('jobs').select('title').eq('id', interview.job_id).single(),
          supabase.from('profiles').select('full_name').eq('user_id', interview.applicant_id).single(),
          supabase.from('companies').select('company_name, user_id').eq('user_id', user?.id).single()
        ]);

        const jobTitle = jobResult.data?.title || 'Job';
        const applicantName = applicantResult.data?.full_name || 'Applicant';
        const companyName = companyResult.data?.company_name || 'Company';

        // Get applicant phone for WhatsApp
        const { data: applicantPhone } = await supabase
          .from('profiles')
          .select('phone, whatsapp_number')
          .eq('user_id', interview.applicant_id)
          .single();

        const phone = applicantPhone?.whatsapp_number || applicantPhone?.phone;

        // Map status to telegram event types
        if (status === 'cancelled') {
          // Telegram - Notify applicant
          triggerTelegramEvent('interview_cancelled', interview.applicant_id, 'user', applicantName, {
            job_title: jobTitle,
            company_name: companyName,
            original_date: new Date(interview.scheduled_at).toLocaleDateString('en-IN')
          });
          
          // WhatsApp - Notify applicant
          if (phone) {
            triggerWhatsAppEvent('interview_cancelled', phone, applicantName, {
              job_title: jobTitle,
              company_name: companyName,
              original_date: new Date(interview.scheduled_at).toLocaleDateString('en-IN')
            });
          }

          // Push handled server-side by the interview status trigger (template).


          // Telegram - Notify employer
          triggerTelegramEvent('employer_interview_cancelled', user?.id, 'employer', companyName, {
            applicant_name: applicantName,
            job_title: jobTitle
          });

          console.log('✅ Interview cancelled - All notifications sent');
        } else if (status === 'completed') {
          // Telegram - Notify applicant
          triggerTelegramEvent('interview_completed', interview.applicant_id, 'user', applicantName, {
            job_title: jobTitle,
            company_name: companyName
          });

          // WhatsApp - Notify applicant
          if (phone) {
            triggerWhatsAppEvent('interview_completed', phone, applicantName, {
              job_title: jobTitle,
              company_name: companyName
            });
          }

          // Push handled server-side by the interview status trigger (template).


          // Telegram - Notify employer
          triggerTelegramEvent('employer_interview_completed', user?.id, 'employer', companyName, {
            applicant_name: applicantName,
            job_title: jobTitle
          });

          console.log('✅ Interview completed - All notifications sent');
        }
      }

      // Refetch interviews to get updated data
      await fetchInterviews();
      return true;
    } catch (err) {
      console.error('Error updating interview status:', err);
      return false;
    }
  };

  const getStatusCounts = () => {
    const now = new Date();
    const counts = {
      all: interviews.length,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
      rescheduled: 0,
      upcoming: 0,
      live: 0
    };

    interviews.forEach(interview => {
      const status = interview.status.toLowerCase();
      if (counts.hasOwnProperty(status)) {
        counts[status as keyof typeof counts]++;
      }
      
      // Count upcoming (within 10 minutes)
      if (status === 'scheduled' && interview.scheduled_at) {
        const startTime = new Date(interview.scheduled_at);
        const minutesUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
        if (minutesUntil > 0 && minutesUntil <= 10) {
          counts.upcoming++;
        }
      }
      
      // Count live interviews
      if (status === 'scheduled' && interview.scheduled_at && interview.scheduled_end_at) {
        const startTime = new Date(interview.scheduled_at);
        const endTime = new Date(interview.scheduled_end_at);
        if (now >= startTime && now < endTime) {
          counts.live++;
        }
      }
    });

    return counts;
  };

  const getTodaysInterviews = () => {
    const today = new Date().toDateString();
    return interviews.filter(interview => 
      new Date(interview.scheduled_at).toDateString() === today &&
      interview.status === 'scheduled'
    );
  };

  const getUpcomingInterviews = () => {
    const now = new Date();
    return interviews.filter(interview => 
      new Date(interview.scheduled_at) > now &&
      interview.status === 'scheduled'
    );
  };

  return {
    interviews,
    loading,
    error,
    refetch: fetchInterviews,
    scheduleInterview,
    updateInterviewStatus,
    statusCounts: getStatusCounts(),
    todaysInterviews: getTodaysInterviews(),
    upcomingInterviews: getUpcomingInterviews()
  };
};