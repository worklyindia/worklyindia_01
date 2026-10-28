import { useCallback, useEffect, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import { EmployerAuthContext } from '@/contexts/EmployerAuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { FirebasePushService } from '@/services/FirebasePushService';
import { toast } from 'sonner';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

export const useComprehensiveNotifications = () => {
  // Use context directly to avoid throwing if provider is missing
  const authContext = useContext(AuthContext);
  const employerAuthContext = useContext(EmployerAuthContext);
  
  const jobSeekerUser = authContext?.user ?? null;
  const employerUser = (employerAuthContext as { user?: { id: string } } | undefined)?.user ?? null;
  const { createNotification } = useNotifications();

  const currentUser = jobSeekerUser || employerUser;
  const isEmployer = !!employerUser;

  // Job Application Notifications
  const sendJobApplicationNotification = useCallback(async (
    applicantId: string,
    employerId: string,
    jobId: string,
    jobTitle: string,
    companyName: string
  ) => {
    try {
      // Notification for job seeker (applicant confirmation)
      await createNotification({
        userId: applicantId,
        title: 'Application Submitted Successfully',
        message: `Your application for ${jobTitle} at ${companyName} has been submitted.`,
        type: 'success',
        actionUrl: '/activity'
      });

      // Notification for employer (new application alert)
      await createNotification({
        userId: employerId,
        title: 'New Job Application',
        message: `Someone applied for your ${jobTitle} position at ${companyName}.`,
        type: 'info',
        actionUrl: `/employer-portal/job-analytics/${jobId}`
      });

      // Send push notifications
      await Promise.all([
        FirebasePushService.sendEmployerNotification(
          applicantId,
          'Application Submitted!',
          `Your application for ${jobTitle} has been submitted successfully.`,
          'https://jubwzelupbntbetpajqb.supabase.co/activity'
        ),
        FirebasePushService.sendEmployerNotification(
          employerId,
          'New Job Application',
          `New application received for ${jobTitle} position.`,
          `https://jubwzelupbntbetpajqb.supabase.co/employer-portal/job-analytics/${jobId}`
        )
      ]);

      console.log('✅ Job application notifications sent successfully');
    } catch (error) {
      console.error('Error sending job application notifications:', error);
    }
  }, [createNotification]);

  // Application Status Update Notifications
  const sendApplicationStatusNotification = useCallback(async (
    applicantId: string,
    jobId: string,
    jobTitle: string,
    companyName: string,
    oldStatus: string,
    newStatus: string
  ) => {
    try {
      const statusMessages = {
        shortlisted: {
          title: 'Great News! You\'ve Been Shortlisted',
          message: `Congratulations! You have been shortlisted for ${jobTitle} at ${companyName}.`,
          type: 'success' as const
        },
        interview_scheduled: {
          title: 'Interview Scheduled',
          message: `An interview has been scheduled for ${jobTitle} at ${companyName}.`,
          type: 'info' as const
        },
        rejected: {
          title: 'Application Update',
          message: `Thank you for your interest in ${jobTitle} at ${companyName}. We have decided to move forward with other candidates.`,
          type: 'info' as const
        },
        hired: {
          title: 'Congratulations! You\'re Hired!',
          message: `Congratulations! You have been selected for ${jobTitle} at ${companyName}.`,
          type: 'success' as const
        }
      };

      const statusUpdate = statusMessages[newStatus as keyof typeof statusMessages];
      if (!statusUpdate) return;

      await createNotification({
        userId: applicantId,
        title: statusUpdate.title,
        message: statusUpdate.message,
        type: statusUpdate.type,
        actionUrl: `/job/${jobId}`
      });

      // Push notification is sent server-side by the application-status database
      // trigger (template: application_status_changed). Do NOT send it here too,
      // otherwise the user receives the same notification twice.

      console.log('✅ Application status notification sent successfully');
    } catch (error) {
      console.error('Error sending application status notification:', error);
    }
  }, [createNotification]);

  // Interview Scheduling Notifications
  const sendInterviewNotification = useCallback(async (
    applicantId: string,
    employerId: string,
    jobId: string,
    jobTitle: string,
    companyName: string,
    scheduledAt: string,
    mode: string,
    location?: string
  ) => {
    try {
      const formattedDate = new Date(scheduledAt).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Notification for applicant
      await createNotification({
        userId: applicantId,
        title: 'Interview Scheduled',
        message: `Your interview for ${jobTitle} at ${companyName} is scheduled for ${formattedDate}.`,
        type: 'info',
        actionUrl: '/activity'
      });

      // Notification for employer
      await createNotification({
        userId: employerId,
        title: 'Interview Scheduled',
        message: `Interview scheduled for ${jobTitle} position on ${formattedDate}.`,
        type: 'info',
        actionUrl: '/employer/interviews'
      });

      // Send push notifications
      await Promise.all([
        FirebasePushService.sendEmployerNotification(
          applicantId,
          'Interview Scheduled!',
          `Your interview for ${jobTitle} is scheduled for ${formattedDate}.`,
          'https://jubwzelupbntbetpajqb.supabase.co/activity'
        ),
        FirebasePushService.sendEmployerNotification(
          employerId,
          'Interview Scheduled',
          `Interview scheduled for ${jobTitle} on ${formattedDate}.`,
          'https://jubwzelupbntbetpajqb.supabase.co/employer/interviews'
        )
      ]);

      console.log('✅ Interview notifications sent successfully');
    } catch (error) {
      console.error('Error sending interview notifications:', error);
    }
  }, [createNotification]);

  // Job Recommendation Notifications
  const sendJobRecommendationNotification = useCallback(async (
    userId: string,
    jobTitle: string,
    companyName: string,
    jobId: string,
    matchScore: number
  ) => {
    try {
      await createNotification({
        userId,
        title: 'New Job Match Found!',
        message: `${jobTitle} at ${companyName} matches your profile (${matchScore}% match).`,
        type: 'info',
        actionUrl: `/job/${jobId}`
      });

      // Send push notification
      await FirebasePushService.sendEmployerNotification(
        userId,
        'New Job Match!',
        `${jobTitle} at ${companyName} is a great match for you!`,
        `https://jubwzelupbntbetpajqb.supabase.co/job/${jobId}`
      );

      console.log('✅ Job recommendation notification sent successfully');
    } catch (error) {
      console.error('Error sending job recommendation notification:', error);
    }
  }, [createNotification]);

  // Weekly Job Digest Notifications
  const sendWeeklyJobDigest = useCallback(async (userId: string) => {
    try {
      // Get user's recommended jobs
      const { data: recommendedJobs, error } = await supabase
        .rpc('get_recommended_jobs', { p_user_id: userId });

      if (error || !recommendedJobs || recommendedJobs.length === 0) {
        console.log('No recommended jobs for weekly digest');
        return;
      }

      const topJobs = recommendedJobs.slice(0, 5);
      const title = 'Weekly Job Digest';
      const message = `${topJobs.length} new job matches this week including ${topJobs[0].title} at ${topJobs[0].company}`;

      await createNotification({
        userId,
        title,
        message,
        type: 'info',
        actionUrl: '/jobs'
      });

      // Send push notification
      await FirebasePushService.sendEmployerNotification(
        userId,
        title,
        message,
        'https://jubwzelupbntbetpajqb.supabase.co/jobs'
      );

      console.log('✅ Weekly job digest sent successfully');
    } catch (error) {
      console.error('Error sending weekly job digest:', error);
    }
  }, [createNotification]);

  // Payment Success Notifications
  const sendPaymentSuccessNotification = useCallback(async (
    userId: string,
    amount: number,
    points: number,
    transactionType: string
  ) => {
    try {
      let title = 'Payment Successful!';
      let message = `Your payment of ₹${amount} was successful.`;

      if (transactionType === 'points') {
        message = `₹${amount} payment successful! ${points} points added to your wallet.`;
      } else if (transactionType === 'boost') {
        message = `₹${amount} payment successful! Your job boost is now active.`;
      } else if (transactionType === 'verification') {
        message = `₹${amount} payment successful! Your verification is now active.`;
      }

      await createNotification({
        userId,
        title,
        message,
        type: 'success',
        actionUrl: isEmployer ? '/employer-portal' : '/rewards'
      });

      // Send push notification
      await FirebasePushService.sendEmployerNotification(
        userId,
        title,
        message,
        isEmployer 
          ? 'https://jubwzelupbntbetpajqb.supabase.co/employer-portal'
          : 'https://jubwzelupbntbetpajqb.supabase.co/rewards'
      );

      console.log('✅ Payment success notification sent successfully');
    } catch (error) {
      console.error('Error sending payment success notification:', error);
    }
  }, [createNotification, isEmployer]);

  // Set up real-time listeners for automatic notifications
  useEffect(() => {
    if (!currentUser) return;
    if (!shouldEnableRealtime()) return;

    const setupNotificationTriggers = () => {
      // Listen for job applications
      const applicationsChannel = supabase
        .channel('comprehensive-job-applications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'job_applications'
          },
          async (payload) => {
            const application = payload.new as any;
            
            // Get job and company details
            const { data: jobData } = await supabase
              .from('jobs')
              .select(`
                title,
                companies!inner(
                  company_name,
                  user_id
                )
              `)
              .eq('id', application.job_id)
              .single();

            if (jobData) {
              await sendJobApplicationNotification(
                application.user_id,
                jobData.companies.user_id,
                application.job_id,
                jobData.title,
                jobData.companies.company_name
              );
            }
          }
        )
        .subscribe();

      // Listen for application status updates
      const statusChannel = supabase
        .channel('comprehensive-application-status')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'job_applications'
          },
          async (payload) => {
            const { new: newApp, old: oldApp } = payload as any;
            
            if (newApp.status !== oldApp.status) {
              // Get job details
              const { data: jobData } = await supabase
                .from('jobs')
                .select(`
                  title,
                  companies!inner(company_name)
                `)
                .eq('id', newApp.job_id)
                .single();

              if (jobData) {
                await sendApplicationStatusNotification(
                  newApp.user_id,
                  newApp.job_id,
                  jobData.title,
                  jobData.companies.company_name,
                  oldApp.status,
                  newApp.status
                );
              }
            }
          }
        )
        .subscribe();

      // Listen for interview scheduling
      const interviewsChannel = supabase
        .channel('comprehensive-interviews')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'interviews'
          },
          async (payload) => {
            const interview = payload.new as any;
            
            // Get job and company details
            const { data: jobData } = await supabase
              .from('jobs')
              .select(`
                title,
                companies!inner(
                  company_name,
                  user_id
                )
              `)
              .eq('id', interview.job_id)
              .single();

            if (jobData) {
              await sendInterviewNotification(
                interview.applicant_id,
                jobData.companies.user_id,
                interview.job_id,
                jobData.title,
                jobData.companies.company_name,
                interview.scheduled_at,
                interview.mode,
                interview.location_url
              );
            }
          }
        )
        .subscribe();

      // Listen for successful payments
      const paymentsChannel = supabase
        .channel('comprehensive-payments')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions'
          },
          async (payload) => {
            const { new: newTxn, old: oldTxn } = payload as any;
            
            if (newTxn.status === 'success' && oldTxn.status !== 'success') {
              await sendPaymentSuccessNotification(
                newTxn.user_id,
                newTxn.amount,
                newTxn.points,
                'points'
              );
            }
          }
        )
        .subscribe();

      // Listen for referral events
      const referralsChannel = supabase
        .channel('comprehensive-referrals')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_referrals'
          },
          async (payload) => {
            const referral = payload.new as any;
            
            // Send referral join notifications
            const { data: referrerProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', referral.referrer_id)
              .single();

            const { data: referredProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', referral.referred_user_id)
              .single();

            // Send push notifications for referral join
            await supabase.functions.invoke('email-api', {
              body: {
                action: 'referral_notification',
                event_type: 'referral_join',
                referrer_id: referral.referrer_id,
                referred_user_id: referral.referred_user_id,
                referrer_name: referrerProfile?.full_name || 'Someone',
                referred_name: referredProfile?.full_name || 'New User'
              }
            });
          }
        )
        .subscribe();

      // Listen for commission updates
      const commissionsChannel = supabase
        .channel('comprehensive-commissions')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'referral_commissions'
          },
          async (payload) => {
            const { new: newCommission, old: oldCommission } = payload as any;
            
            if (newCommission.status === 'completed' && oldCommission.status !== 'completed') {
              // Get total commissions
              const { data: commissionsData } = await supabase
                .from('referral_commissions')
                .select('commission_amount')
                .eq('referrer_id', newCommission.referrer_id)
                .eq('status', 'completed');

              const totalCommissions = commissionsData?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

              // Send commission notification
              await supabase.functions.invoke('email-api', {
                body: {
                  action: 'referral_notification',
                  event_type: 'commission_earned',
                  referrer_id: newCommission.referrer_id,
                  commission_amount: Number(newCommission.commission_amount),
                  total_commissions: totalCommissions
                }
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(applicationsChannel);
        supabase.removeChannel(statusChannel);
        supabase.removeChannel(interviewsChannel);
        supabase.removeChannel(paymentsChannel);
        supabase.removeChannel(referralsChannel);
        supabase.removeChannel(commissionsChannel);
      };
    };

    const cleanup = setupNotificationTriggers();
    return cleanup;
  }, [
    currentUser,
    sendJobApplicationNotification,
    sendApplicationStatusNotification,
    sendInterviewNotification,
    sendPaymentSuccessNotification
  ]);

  return {
    sendJobApplicationNotification,
    sendApplicationStatusNotification,
    sendInterviewNotification,
    sendJobRecommendationNotification,
    sendWeeklyJobDigest,
    sendPaymentSuccessNotification
  };
};