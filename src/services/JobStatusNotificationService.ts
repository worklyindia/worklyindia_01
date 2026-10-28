import { supabase } from '@/integrations/supabase/client';
import { FirebasePushService } from './FirebasePushService';
import { triggerWhatsAppEvent } from '@/hooks/useWhatsAppTrigger';
import { triggerTelegramEvent } from '@/hooks/useTelegramTrigger';

export class JobStatusNotificationService {
  // Create notification for job application status changes
  static async notifyApplicationStatusChange(
    userId: string,
    jobId: string,
    jobTitle: string,
    companyName: string,
    status: string,
    previousStatus?: string
  ) {
    try {
      const notifications = this.getStatusNotificationContent(status, jobTitle, companyName);
      
      if (notifications) {
        // Create database notification
        const { error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: notifications.title,
            message: notifications.message,
            type: notifications.type,
            action_url: `/activity`,
            metadata: {
              job_id: jobId,
              application_status: status,
              previous_status: previousStatus,
              company_name: companyName,
              match_type: 'application'
            }
          });

        if (dbError) {
          console.error('Error creating application status notification:', dbError);
        }

        // Push is sent server-side by the application-status database trigger
        // (owner push template). Sending it here again created duplicates.

        // Send WhatsApp notification based on status
        await this.sendWhatsAppForApplicationStatus(userId, jobTitle, companyName, status);

        // Send Telegram notification based on status
        await this.sendTelegramForApplicationStatus(userId, jobTitle, companyName, status);

        console.log(`✅ Application status notification sent to user ${userId} for status: ${status}`);

        console.log(`✅ Application status notification sent to user ${userId} for status: ${status}`);
      }
    } catch (error) {
      console.error('Error sending application status notification:', error);
    }
  }

  // Send WhatsApp notification for application status changes
  private static async sendWhatsAppForApplicationStatus(
    userId: string,
    jobTitle: string,
    companyName: string,
    status: string
  ) {
    try {
      // Get user's phone number - use user_id not id
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, whatsapp_number')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        console.log('⚠️ WhatsApp notification skipped - profile not found for user_id:', userId);
        return;
      }

      const phone = profile.whatsapp_number || profile.phone;
      if (!phone) {
        console.log('⚠️ WhatsApp notification skipped - no phone for user_id:', userId);
        return;
      }

      const name = profile.full_name || 'User';

      // Map status to event type
      const statusToEvent: Record<string, string> = {
        'applied': 'application_submitted',
        'shortlisted': 'application_shortlisted',
        'rejected': 'application_rejected',
        'under review': 'application_under_review',
        'reviewed': 'application_under_review',
        'hired': 'application_hired'
      };

      const eventType = statusToEvent[status.toLowerCase()];
      if (eventType) {
        await triggerWhatsAppEvent(eventType, phone, name, {
          job_title: jobTitle,
          company_name: companyName
        });
      }
    } catch (error) {
      console.error('Error sending WhatsApp for application status:', error);
    }
  }

  // Send Telegram notification for application status changes
  private static async sendTelegramForApplicationStatus(
    userId: string,
    jobTitle: string,
    companyName: string,
    status: string
  ) {
    try {
      // Get user's profile data - use user_id not id
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, user_id')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        console.log('⚠️ Telegram notification skipped - profile not found for user_id:', userId);
        return;
      }

      const name = profile.full_name || 'User';

      // Map status to Telegram event type
      const statusToEvent: Record<string, string> = {
        'applied': 'application_submitted',
        'shortlisted': 'application_shortlisted',
        'rejected': 'application_rejected',
        'under review': 'application_viewed',
        'reviewed': 'application_viewed',
        'hired': 'application_shortlisted' // Use shortlisted template for hired
      };

      const eventType = statusToEvent[status.toLowerCase()];
      if (eventType) {
        await triggerTelegramEvent(eventType, profile.user_id, 'user', name, {
          job_title: jobTitle,
          company_name: companyName
        });
      }
    } catch (error) {
      console.error('Error sending Telegram for application status:', error);
    }
  }

  // Create notification for interview status changes
  static async notifyInterviewStatusChange(
    userId: string,
    interviewId: string,
    jobId: string,
    jobTitle: string,
    companyName: string,
    status: string,
    scheduledAt?: string,
    mode?: string,
    locationUrl?: string
  ) {
    try {
      const notifications = this.getInterviewNotificationContent(
        status, 
        jobTitle, 
        companyName, 
        scheduledAt, 
        mode
      );
      
      if (notifications) {
        // Create database notification
        const { error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: notifications.title,
            message: notifications.message,
            type: notifications.type,
            action_url: `/activity`,
            metadata: {
              interview_id: interviewId,
              job_id: jobId,
              interview_status: status,
              scheduled_at: scheduledAt,
              mode: mode,
              location_url: locationUrl,
              company_name: companyName,
              match_type: 'interview'
            }
          });

        if (dbError) {
          console.error('Error creating interview notification:', dbError);
        }

        // Push is sent server-side by the interview-status database trigger
        // (owner push template). Sending it here again created duplicates.

        // Send WhatsApp notification for interview
        await this.sendWhatsAppForInterview(userId, jobTitle, companyName, status, scheduledAt, mode);

        // Send Telegram notification for interview
        await this.sendTelegramForInterview(userId, jobTitle, companyName, status, scheduledAt, mode);

        console.log(`✅ Interview notification sent to user ${userId} for status: ${status}`);
      }
    } catch (error) {
      console.error('Error sending interview notification:', error);
    }
  }

  // Send WhatsApp notification for interview status changes
  private static async sendWhatsAppForInterview(
    userId: string,
    jobTitle: string,
    companyName: string,
    status: string,
    scheduledAt?: string,
    mode?: string
  ) {
    try {
      // Get user's phone number - use user_id not id
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, whatsapp_number')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        console.log('⚠️ WhatsApp interview notification skipped - profile not found for user_id:', userId);
        return;
      }

      const phone = profile.whatsapp_number || profile.phone;
      if (!phone) {
        console.log('⚠️ WhatsApp interview notification skipped - no phone for user_id:', userId);
        return;
      }

      const name = profile.full_name || 'User';

      // Format date and time if available
      let date = '';
      let time = '';
      if (scheduledAt) {
        const dateObj = new Date(scheduledAt);
        date = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        time = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }

      // Map status to event type
      const statusToEvent: Record<string, string> = {
        'scheduled': 'interview_scheduled',
        'rescheduled': 'interview_rescheduled',
        'cancelled': 'interview_cancelled',
        'live': 'interview_reminder'
      };

      const eventType = statusToEvent[status.toLowerCase()];
      if (eventType) {
        await triggerWhatsAppEvent(eventType, phone, name, {
          job_title: jobTitle,
          company_name: companyName,
          date,
          time,
          mode: mode || 'Video'
        });
      }
    } catch (error) {
      console.error('Error sending WhatsApp for interview:', error);
    }
  }

  // Send Telegram notification for interview status changes
  private static async sendTelegramForInterview(
    userId: string,
    jobTitle: string,
    companyName: string,
    status: string,
    scheduledAt?: string,
    mode?: string
  ) {
    try {
      // Get user's profile data - use user_id not id
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, user_id')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        console.log('⚠️ Telegram interview notification skipped - profile not found for user_id:', userId);
        return;
      }

      const name = profile.full_name || 'User';

      // Format date and time if available
      let date = '';
      let time = '';
      if (scheduledAt) {
        const dateObj = new Date(scheduledAt);
        date = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        time = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }

      // Map status to Telegram event type
      const statusToEvent: Record<string, string> = {
        'scheduled': 'interview_scheduled',
        'rescheduled': 'interview_scheduled',
        'cancelled': 'interview_cancelled',
        'completed': 'interview_completed',
        'live': 'interview_reminder'
      };

      const eventType = statusToEvent[status.toLowerCase()];
      if (eventType) {
        await triggerTelegramEvent(eventType, profile.user_id, 'user', name, {
          job_title: jobTitle,
          company_name: companyName,
          date,
          time,
          mode: mode || 'Video'
        });
      }
    } catch (error) {
      console.error('Error sending Telegram for interview:', error);
    }
  }

  // Create notification for job recommendations
  static async notifyJobRecommendation(
    userId: string,
    jobId: string,
    jobTitle: string,
    companyName: string,
    location: string,
    matchScore?: number
  ) {
    try {
      const title = "New Job Match Found! 🎯";
      const message = `${jobTitle} at ${companyName} in ${location}${matchScore ? ` (${matchScore}% match)` : ''}`;
      
      // Create database notification
      const { error: dbError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: title,
          message: message,
          type: 'info',
          action_url: `/job/${jobId}`,
          metadata: {
            job_id: jobId,
            company_name: companyName,
            location: location,
            match_score: matchScore,
            match_type: 'profile_match'
          }
        });

      if (dbError) {
        console.error('Error creating job recommendation notification:', dbError);
      }

      // Send push notification
      await FirebasePushService.sendEmployerNotification(userId, title, message, `/job/${jobId}`);

      console.log(`✅ Job recommendation notification sent to user ${userId} for job: ${jobTitle}`);
    } catch (error) {
      console.error('Error sending job recommendation notification:', error);
    }
  }

  private static getStatusNotificationContent(status: string, jobTitle: string, companyName: string) {
    switch (status.toLowerCase()) {
      case 'applied':
        return {
          title: "Application Submitted ✅",
          message: `Your application for ${jobTitle} at ${companyName} has been successfully submitted.`,
          type: 'success' as const
        };
      case 'under review':
      case 'reviewed':
        return {
          title: "Application Under Review 👀",
          message: `${companyName} is now reviewing your application for ${jobTitle}.`,
          type: 'info' as const
        };
      case 'shortlisted':
        return {
          title: "You've Been Shortlisted! 🎉",
          message: `Great news! ${companyName} has shortlisted you for ${jobTitle}. They may contact you soon.`,
          type: 'success' as const
        };
      case 'interview_scheduled':
        return {
          title: "Interview Scheduled 📅",
          message: `${companyName} has scheduled an interview for ${jobTitle}. Check your activity for details.`,
          type: 'success' as const
        };
      case 'rejected':
        return {
          title: "Application Update 📋",
          message: `${companyName} has updated your application status for ${jobTitle}. Keep applying to find the right fit!`,
          type: 'info' as const
        };
      case 'hired':
        return {
          title: "Congratulations! You're Hired! 🎊",
          message: `Amazing! ${companyName} has selected you for ${jobTitle}. Welcome to the team!`,
          type: 'success' as const
        };
      default:
        return null;
    }
  }

  private static getInterviewNotificationContent(
    status: string, 
    jobTitle: string, 
    companyName: string,
    scheduledAt?: string,
    mode?: string
  ) {
    const formatDate = (dateString?: string) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    switch (status.toLowerCase()) {
      case 'scheduled':
        return {
          title: "Interview Scheduled 📅",
          message: `Your ${mode || 'interview'} interview for ${jobTitle} at ${companyName} is scheduled for ${formatDate(scheduledAt)}.`,
          type: 'success' as const
        };
      case 'rescheduled':
        return {
          title: "Interview Rescheduled 🔄",
          message: `Your interview for ${jobTitle} at ${companyName} has been rescheduled to ${formatDate(scheduledAt)}.`,
          type: 'info' as const
        };
      case 'cancelled':
        return {
          title: "Interview Cancelled ❌",
          message: `Your interview for ${jobTitle} at ${companyName} has been cancelled. They may reschedule soon.`,
          type: 'warning' as const
        };
      case 'completed':
        return {
          title: "Interview Completed ✅",
          message: `Your interview for ${jobTitle} at ${companyName} is complete. We'll notify you when there's an update!`,
          type: 'success' as const
        };
      case 'live':
        return {
          title: "Interview Starting Now! 🔴",
          message: `Your interview for ${jobTitle} at ${companyName} is starting now. Good luck!`,
          type: 'info' as const
        };
      case 'ended':
        return {
          title: "Interview Ended 🏁",
          message: `Your interview for ${jobTitle} at ${companyName} has ended. Thank you for participating!`,
          type: 'info' as const
        };
      default:
        return null;
    }
  }

  // Method to be called when application status changes in database
  static async handleApplicationStatusChange(applicationData: {
    user_id: string;
    job_id: string;
    status: string;
    previous_status?: string;
  }) {
    try {
      // Get job details
      const { data: jobData } = await supabase
        .from('jobs')
        .select('title, companies(company_name)')
        .eq('id', applicationData.job_id)
        .single();

      if (jobData) {
        await this.notifyApplicationStatusChange(
          applicationData.user_id,
          applicationData.job_id,
          jobData.title,
          (jobData as any).companies?.company_name || 'Company',
          applicationData.status,
          applicationData.previous_status
        );
      }
    } catch (error) {
      console.error('Error handling application status change:', error);
    }
  }

  // Method to be called when interview status changes in database
  static async handleInterviewStatusChange(interviewData: {
    id: string;
    applicant_id: string;
    job_id: string;
    status: string;
    scheduled_at?: string;
    mode?: string;
    location_url?: string;
  }) {
    try {
      // Get job details
      const { data: jobData } = await supabase
        .from('jobs')
        .select('title, companies(company_name)')
        .eq('id', interviewData.job_id)
        .single();

      if (jobData) {
        await this.notifyInterviewStatusChange(
          interviewData.applicant_id,
          interviewData.id,
          interviewData.job_id,
          jobData.title,
          (jobData as any).companies?.company_name || 'Company',
          interviewData.status,
          interviewData.scheduled_at,
          interviewData.mode,
          interviewData.location_url
        );
      }
    } catch (error) {
      console.error('Error handling interview status change:', error);
    }
  }
}