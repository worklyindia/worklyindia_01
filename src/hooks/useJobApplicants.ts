import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerWhatsAppEvent } from '@/hooks/useWhatsAppTrigger';
import { FirebasePushService } from '@/services/FirebasePushService';

export interface JobApplicant {
  id: string;
  job_id: string;
  user_id: string;
  applied_at: string;
  status: string;
  cover_letter?: string;
  resume_url?: string;
  application_source?: 'api' | 'website';
  // API-specific structured data
  api_social_links?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    linkedin?: string;
  };
  api_certifications?: Array<{
    certification_name: string;
    issuing_organization: string;
    issue_date?: string;
    expiry_date?: string;
    credential_id?: string;
    credential_url?: string;
    description?: string;
  }>;
  api_professional_experiences?: Array<{
    position: string;
    company?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    description?: string;
  }>;
  api_education_entries?: Array<{
    degree: string;
    institution?: string;
    field_of_study?: string;
    start_year?: number;
    end_year?: number;
    grade?: string;
    description?: string;
  }>;
  // API-specific basic data
  api_full_name?: string;
  api_email?: string;
  api_phone?: string;
  api_whatsapp_number?: string;
  api_location?: string;
  api_skills?: string[];
  api_bio?: string;
  api_current_position?: string;
  api_company?: string;
  api_experience_years?: number;
  api_languages?: string[];
  profile?: {
    user_id?: string;
    full_name?: string;
    phone?: string;
    email?: string;
    location?: string;
    current_position?: string;
    company?: string;
    skills?: string[];
    profile_image_url?: string;
    bio?: string;
    education?: string;
    experience_years?: number;
    experience_level?: number;
    preferred_location?: string;
    job_type?: string;
    industry?: string;
    whatsapp_number?: string;
    instagram_link?: string;
    facebook_link?: string;
    youtube_link?: string;
    linkedin_link?: string;
    precise_address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    languages?: string[];
    telegram_username?: string;
  };
  telegramUsername?: string;
  educationEntries?: Array<{
    id: string;
    degree: string;
    institution?: string;
    field_of_study?: string;
    start_year?: number;
    end_year?: number;
    grade?: string;
    description?: string;
  }>;
  certifications?: Array<{
    id: string;
    certification_name: string;
    issuing_organization: string;
    issue_date?: string;
    expiry_date?: string;
    credential_id?: string;
    credential_url?: string;
    description?: string;
  }>;
  professionalExperiences?: Array<{
    id: string;
    position: string;
    company?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    description?: string;
    experience_years?: number;
  }>;
  job?: {
    title: string;
  };
}

export const useJobApplicants = (jobId?: string) => {
  const [applicants, setApplicants] = useState<JobApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user && jobId) {
      fetchApplicants();
    }
  }, [user, jobId]);

  const fetchApplicants = async () => {
    if (!user || !jobId) {
      console.log('Missing user or jobId:', { user: !!user, jobId });
      return;
    }
    
    // Validate jobId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      console.error('Invalid job ID format:', jobId);
      setError('Invalid job link. Please check the URL.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('Fetching applicants for job:', jobId);
      
      // First verify user owns this job - use maybeSingle for better error handling
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          companies!inner(user_id)
        `)
        .eq('id', jobId)
        .eq('companies.user_id', user.id)
        .maybeSingle();

      if (jobError) {
        console.error('Job ownership check error:', jobError);
        throw new Error(`Database error: ${jobError.message}`);
      }

      if (!job) {
        console.error('Job not found or access denied for user:', user.id, 'job:', jobId);
        throw new Error('Job not found or you don\'t have permission to view its applicants');
      }

      // Use the new function to get applicants with emails
      console.log('Calling RPC function get_job_applicants_with_emails...');
      const { data: applicantsData, error: applicantsError } = await supabase
        .rpc('get_job_applicants_with_emails', { p_job_id: jobId });

      if (applicantsError) {
        console.error('RPC function error:', applicantsError);
        throw new Error(`Failed to fetch applicants: ${applicantsError.message}`);
      }

      if (!applicantsData || applicantsData.length === 0) {
        setApplicants([]);
        return;
      }

      // Get user IDs for fetching additional data (filter out null values for guest applicants)
      const userIds = applicantsData
        .map(app => app.user_id)
        .filter((id): id is string => id !== null && id !== undefined);

      console.log('[DEBUG] Valid userIds (non-null):', userIds);
      console.log('[DEBUG] Total applicants:', applicantsData.length, 'With user_id:', userIds.length);

      // Only fetch additional data if there are valid user IDs
      let educationData: any[] = [];
      let certificationsData: any[] = [];
      let experiencesData: any[] = [];
      let telegramData: any[] = [];

      if (userIds.length > 0) {
        // Fetch education entries
        const { data: eduData, error: educationError } = await supabase
          .from('education_entries')
          .select(`
            id,
            user_id,
            degree,
            institution,
            field_of_study,
            start_year,
            end_year,
            grade,
            description
          `)
          .in('user_id', userIds)
          .order('end_year', { ascending: false });
        
        if (educationError) {
          console.error('[DEBUG] Education fetch error:', educationError);
        } else {
          educationData = eduData || [];
          console.log('[DEBUG] educationData fetched:', educationData);
        }

        // Fetch certifications
        const { data: certData, error: certificationsError } = await supabase
          .from('certifications')
          .select(`
            id,
            user_id,
            certification_name,
            issuing_organization,
            issue_date,
            expiry_date,
            credential_id,
            credential_url,
            description
          `)
          .in('user_id', userIds)
          .order('issue_date', { ascending: false });

        if (certificationsError) {
          console.error('[DEBUG] Certifications fetch error:', certificationsError);
        } else {
          certificationsData = certData || [];
          console.log('[DEBUG] certificationsData fetched:', certificationsData);
        }

        // Fetch professional experiences
        const { data: expData, error: experiencesError } = await supabase
          .from('professional_experiences')
          .select(`
            id,
            user_id,
            position,
            company,
            start_date,
            end_date,
            is_current,
            description,
            experience_years
          `)
          .in('user_id', userIds)
          .order('start_date', { ascending: false });

        if (experiencesError) {
          console.error('[DEBUG] Experiences fetch error:', experiencesError);
        } else {
          experiencesData = expData || [];
          console.log('[DEBUG] experiencesData fetched:', experiencesData);
        }

        // Fetch telegram usernames
        const { data: tgData, error: telegramError } = await supabase
          .from('profiles')
          .select('user_id, telegram_username')
          .in('user_id', userIds)
          .not('telegram_username', 'is', null);

        if (telegramError) {
          console.error('[DEBUG] Telegram fetch error:', telegramError);
        } else {
          telegramData = tgData || [];
          console.log('[DEBUG] telegramData fetched:', telegramData);
        }
      } else {
        console.log('[DEBUG] No valid userIds, skipping additional data fetch');
      }

      // Create telegram lookup map
      const telegramMap = (telegramData || []).reduce((acc, tg) => {
        acc[tg.user_id] = tg.telegram_username;
        return acc;
      }, {} as Record<string, string>);
      // Create lookup maps for additional data
      const educationMap = (educationData || []).reduce((acc, edu) => {
        if (!acc[edu.user_id]) acc[edu.user_id] = [];
        acc[edu.user_id].push(edu);
        return acc;
      }, {} as Record<string, any[]>);

      const certificationsMap = (certificationsData || []).reduce((acc, cert) => {
        if (!acc[cert.user_id]) acc[cert.user_id] = [];
        acc[cert.user_id].push(cert);
        return acc;
      }, {} as Record<string, any[]>);

      const experiencesMap = (experiencesData || []).reduce((acc, exp) => {
        if (!acc[exp.user_id]) acc[exp.user_id] = [];
        acc[exp.user_id].push(exp);
        return acc;
      }, {} as Record<string, any[]>);

      // Debug logging
      console.log('[DEBUG] educationData:', educationData);
      console.log('[DEBUG] certificationsData:', certificationsData);
      console.log('[DEBUG] experiencesData:', experiencesData);
      console.log('[DEBUG] educationMap:', educationMap);
      console.log('[DEBUG] certificationsMap:', certificationsMap);
      console.log('[DEBUG] experiencesMap:', experiencesMap);
      console.log('[DEBUG] userIds:', userIds);

      // Fetch API-specific data from job_applications
      const { data: apiDataList, error: apiDataError } = await supabase
        .from('job_applications')
        .select(`
          id, 
          application_source, 
          api_social_links, 
          api_certifications, 
          api_professional_experiences, 
          api_education_entries,
          api_full_name,
          api_email,
          api_phone,
          api_whatsapp_number,
          api_location,
          api_skills,
          api_bio,
          api_current_position,
          api_company,
          api_experience_years,
          api_languages
        `)
        .in('id', applicantsData.map(app => app.application_id));

      const apiDataMap = (apiDataList || []).reduce((acc, apiData) => {
        acc[apiData.id] = apiData;
        return acc;
      }, {} as Record<string, any>);

      // Format applicants using the function result data
      const formattedApplicants = applicantsData.map(app => {
        const apiData = apiDataMap[app.application_id] || {};
        return {
          id: app.application_id,
          job_id: app.job_id,
          user_id: app.user_id,
          applied_at: app.applied_at,
          status: app.status,
          cover_letter: app.cover_letter,
          resume_url: app.resume_url,
          reviewed_at: app.reviewed_at,
          application_source: apiData.application_source || 'website',
          // API-specific structured data
          api_social_links: apiData.api_social_links,
          api_certifications: apiData.api_certifications,
          api_professional_experiences: apiData.api_professional_experiences,
          api_education_entries: apiData.api_education_entries,
          // API-specific basic data
          api_full_name: apiData.api_full_name,
          api_email: apiData.api_email,
          api_phone: apiData.api_phone,
          api_whatsapp_number: apiData.api_whatsapp_number,
          api_location: apiData.api_location,
          api_skills: apiData.api_skills,
          api_bio: apiData.api_bio,
          api_current_position: apiData.api_current_position,
          api_company: apiData.api_company,
          api_experience_years: apiData.api_experience_years,
          api_languages: apiData.api_languages,
          profile: {
            user_id: app.user_id,
            full_name: app.full_name,
            phone: app.phone,
            email: app.email,
            location: app.location,
            current_position: app.current_position,
            company: app.company,
            skills: app.skills,
            profile_image_url: app.profile_image_url,
            bio: app.bio,
            education: app.education,
            experience_years: app.experience_years,
            experience_level: app.experience_level,
            preferred_location: app.preferred_location,
            job_type: app.job_type,
            industry: app.industry,
            whatsapp_number: app.whatsapp_number,
            instagram_link: app.instagram_link,
            facebook_link: app.facebook_link,
            youtube_link: app.youtube_link,
            linkedin_link: app.linkedin_link,
            precise_address: app.precise_address,
            city: app.city,
            state: app.state,
            country: app.country,
            postal_code: app.postal_code,
            languages: app.languages,
            telegram_username: telegramMap[app.user_id] || undefined
          },
          telegramUsername: telegramMap[app.user_id] || undefined,
          educationEntries: educationMap[app.user_id] || [],
          certifications: certificationsMap[app.user_id] || [],
          professionalExperiences: experiencesMap[app.user_id] || [],
          job: { title: job.title }
        };
      });

      setApplicants(formattedApplicants);
    } catch (err) {
      console.error('Error fetching applicants:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch applicants';
      console.error('Setting error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    try {
      // Get application details before update for notifications
      const applicant = applicants.find(app => app.id === applicationId);
      
      const { error } = await supabase
        .from('job_applications')
        .update({ 
          status: newStatus,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) throw error;

      // Update local state
      setApplicants(prev => prev.map(app => 
        app.id === applicationId 
          ? { ...app, status: newStatus }
          : app
      ));

      // Server-side push + in-app notification for the candidate (reliable path)
      supabase.functions
        .invoke('email-api', {
          body: {
            action: 'application_status_notification',
            application_id: applicationId,
            new_status: newStatus
          }
        })
        .catch((e) => console.error('Status notification dispatch failed:', e));

      // Send Telegram notification to applicant for status change
      if (applicant?.user_id) {
        try {
          // Get job and company details
          const { data: jobData } = await supabase
            .from('jobs')
            .select('title, companies(company_name)')
            .eq('id', jobId)
            .single();
          
          const jobTitle = jobData?.title || 'Job';
          const companyName = (jobData?.companies as any)?.company_name || 'Company';
          const applicantName = applicant.profile?.full_name || applicant.api_full_name || 'Candidate';
          
          // Map status to appropriate trigger event
          const statusTriggerMap: Record<string, string> = {
            'shortlisted': 'application_shortlisted',
            'reviewed': 'application_viewed', 
            'rejected': 'application_rejected',
            'hired': 'application_hired',
            'interview_scheduled': 'interview_scheduled'
          };
          
          const triggerEvent = statusTriggerMap[newStatus.toLowerCase()];
          
          if (triggerEvent) {
            // Get applicant phone for WhatsApp
            const { data: applicantProfile } = await supabase
              .from('profiles')
              .select('phone, whatsapp_number')
              .eq('user_id', applicant.user_id)
              .single();

            const phone = applicantProfile?.whatsapp_number || applicantProfile?.phone;

            // Telegram is sent server-side by the application-status fan-out
            // (email-api → telegram_lifecycle_templates).
            // Sending it here as well delivered two identical messages.


            // Send WhatsApp notification
            if (phone) {
              await triggerWhatsAppEvent(triggerEvent, phone, applicantName, {
                job_title: jobTitle,
                company_name: companyName
              });
            }

            // Push notification is sent server-side by the application-status
            // database trigger using the owner's push template
            // (application_status_changed / interview_status_update), which adds
            // the brand logo and a single action button. Sending it here as well
            // caused every user to receive two notifications.

            console.log(`📱 Notifications sent for status change: ${triggerEvent}`, {
              userId: applicant.user_id,
              status: newStatus,
              telegram: true,
              whatsapp: !!phone,
              push: 'server-side template'
            });
          }
        } catch (notifError) {
          console.error('Failed to send status change notification:', notifError);
        }
      }

      return true;
    } catch (err) {
      console.error('Error updating application status:', err);
      return false;
    }
  };

  const getStatusCounts = () => {
    const counts = {
      all: applicants.length,
      applied: 0,
      reviewed: 0,
      shortlisted: 0,
      interview_scheduled: 0,
      rejected: 0,
      hired: 0,
      guest: 0
    };

    applicants.forEach(app => {
      const status = app.status.toLowerCase();
      if (counts.hasOwnProperty(status)) {
        counts[status as keyof typeof counts]++;
      }
      // Count guest applications (no user_id)
      if (!app.user_id) {
        counts.guest++;
      }
    });

    return counts;
  };

  return {
    applicants,
    loading,
    error,
    refetch: fetchApplicants,
    updateApplicationStatus,
    statusCounts: getStatusCounts()
  };
};