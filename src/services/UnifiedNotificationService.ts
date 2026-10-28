import { triggerPushEvent } from '@/hooks/usePushTrigger';
import { triggerWhatsAppEvent } from '@/hooks/useWhatsAppTrigger';
import { triggerTelegramEvent } from '@/hooks/useTelegramTrigger';
import { supabase } from '@/integrations/supabase/client';

/**
 * UnifiedNotificationService - Single entry point for multi-channel notifications
 * Sends notifications via OneSignal (Push), WhatsApp, and Telegram simultaneously
 */
export class UnifiedNotificationService {
  
  // ==================== JOB SEEKER (WEBSITE USER) EVENTS ====================
  
  /**
   * User Signup Welcome - Triggered after successful signup
   */
  static async notifyUserSignupWelcome(userId: string, userName: string) {
    console.log('🔔 UnifiedNotificationService: User Signup Welcome', { userId, userName });
    
    const results = await Promise.allSettled([
      // OneSignal Push
      triggerPushEvent('push_signup_welcome', userId, 'website_user', userName, { user_name: userName }),
      // WhatsApp - Get phone first
      this.sendUserWhatsApp(userId, 'signup_welcome', { user_name: userName }),
      // Telegram
      triggerTelegramEvent('signup_welcome', userId, 'user', userName, { user_name: userName })
    ]);
    
    this.logResults('User Signup Welcome', results);
    return results;
  }

  /**
   * Profile Complete - Triggered when user completes their profile
   */
  static async notifyUserProfileComplete(userId: string, userName: string) {
    console.log('🔔 UnifiedNotificationService: User Profile Complete', { userId, userName });
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_profile_complete', userId, 'website_user', userName, { user_name: userName }),
      this.sendUserWhatsApp(userId, 'profile_complete', { user_name: userName }),
      triggerTelegramEvent('user_profile_completed', userId, 'user', userName, { user_name: userName }),
      this.triggerEmailEvent('user_profile_completed', userId, 'user', userName, { user_name: userName })
    ]);
    
    this.logResults('User Profile Complete', results);
    return results;
  }

  /**
   * Application Submitted - Triggered when user applies to a job
   */
  static async notifyApplicationSubmitted(
    userId: string,
    userName: string,
    jobTitle: string,
    companyName: string,
    employerId?: string,
    employerCompanyName?: string
  ) {
    console.log('🔔 UnifiedNotificationService: Application Submitted', { userId, userName, jobTitle, companyName });
    
    const metadata = {
      job_title: jobTitle,
      company_name: companyName,
      user_name: userName
    };

    // Send to applicant
    const applicantResults = await Promise.allSettled([
      triggerPushEvent('push_application_submitted', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'application_submitted', metadata),
      triggerTelegramEvent('application_submitted', userId, 'user', userName, metadata)
    ]);
    
    // Send to employer if available
    if (employerId) {
      const employerMetadata = {
        applicant_name: userName,
        job_title: jobTitle,
        company_name: employerCompanyName || companyName
      };
      
      await Promise.allSettled([
        triggerPushEvent('push_new_application_received', employerId, 'employer', employerCompanyName || companyName, employerMetadata),
        this.sendEmployerWhatsApp(employerId, 'new_application_received', employerMetadata),
        triggerTelegramEvent('new_application_received', employerId, 'employer', employerCompanyName || companyName, employerMetadata)
      ]);
    }
    
    this.logResults('Application Submitted', applicantResults);
    return applicantResults;
  }

  /**
   * Application Viewed - Triggered when employer views application
   */
  static async notifyApplicationViewed(userId: string, userName: string, jobTitle: string, companyName: string) {
    console.log('🔔 UnifiedNotificationService: Application Viewed', { userId, jobTitle });
    
    const metadata = { job_title: jobTitle, company_name: companyName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_application_viewed', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'application_viewed', metadata),
      triggerTelegramEvent('application_viewed', userId, 'user', userName, metadata)
    ]);
    
    this.logResults('Application Viewed', results);
    return results;
  }

  /**
   * Application Shortlisted
   */
  static async notifyApplicationShortlisted(userId: string, userName: string, jobTitle: string, companyName: string) {
    console.log('🔔 UnifiedNotificationService: Application Shortlisted', { userId, jobTitle });
    
    const metadata = { job_title: jobTitle, company_name: companyName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_application_shortlisted', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'application_shortlisted', metadata),
      triggerTelegramEvent('application_shortlisted', userId, 'user', userName, metadata)
    ]);
    
    this.logResults('Application Shortlisted', results);
    return results;
  }

  /**
   * Application Rejected
   */
  static async notifyApplicationRejected(userId: string, userName: string, jobTitle: string) {
    console.log('🔔 UnifiedNotificationService: Application Rejected', { userId, jobTitle });
    
    const metadata = { job_title: jobTitle };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_application_rejected', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'application_rejected', metadata),
      triggerTelegramEvent('application_rejected', userId, 'user', userName, metadata)
    ]);
    
    this.logResults('Application Rejected', results);
    return results;
  }

  /**
   * Interview Scheduled - Triggered when interview is scheduled
   */
  static async notifyInterviewScheduled(
    userId: string,
    userName: string,
    jobTitle: string,
    companyName: string,
    interviewDate: string,
    employerId?: string,
    employerCompanyName?: string
  ) {
    console.log('🔔 UnifiedNotificationService: Interview Scheduled', { userId, jobTitle, interviewDate });
    
    const metadata = {
      job_title: jobTitle,
      company_name: companyName,
      interview_date: interviewDate
    };

    // Notify applicant
    const applicantResults = await Promise.allSettled([
      triggerPushEvent('push_interview_scheduled', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'interview_scheduled', metadata),
      triggerTelegramEvent('interview_scheduled', userId, 'user', userName, metadata)
    ]);
    
    this.logResults('Interview Scheduled', applicantResults);
    return applicantResults;
  }

  /**
   * Interview Cancelled
   */
  static async notifyInterviewCancelled(userId: string, userName: string, jobTitle: string, employerId?: string, employerCompanyName?: string) {
    console.log('🔔 UnifiedNotificationService: Interview Cancelled', { userId, jobTitle });
    
    const metadata = { job_title: jobTitle };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_interview_cancelled', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'interview_cancelled', metadata),
      triggerTelegramEvent('interview_cancelled', userId, 'user', userName, metadata)
    ]);
    
    if (employerId) {
      await Promise.allSettled([
        triggerPushEvent('push_employer_interview_cancelled', employerId, 'employer', employerCompanyName || 'Company', { applicant_name: userName, job_title: jobTitle }),
        triggerTelegramEvent('employer_interview_cancelled', employerId, 'employer', employerCompanyName || 'Company', { applicant_name: userName, job_title: jobTitle })
      ]);
    }
    
    this.logResults('Interview Cancelled', results);
    return results;
  }

  /**
   * Interview Completed
   */
  static async notifyInterviewCompleted(userId: string, userName: string, jobTitle: string, employerId?: string, employerCompanyName?: string) {
    console.log('🔔 UnifiedNotificationService: Interview Completed', { userId, jobTitle });
    
    const metadata = { job_title: jobTitle };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_interview_completed', userId, 'website_user', userName, metadata),
      triggerTelegramEvent('interview_completed', userId, 'user', userName, metadata)
    ]);
    
    if (employerId) {
      await Promise.allSettled([
        triggerPushEvent('push_employer_interview_completed', employerId, 'employer', employerCompanyName || 'Company', { applicant_name: userName, job_title: jobTitle }),
        triggerTelegramEvent('employer_interview_completed', employerId, 'employer', employerCompanyName || 'Company', { applicant_name: userName, job_title: jobTitle })
      ]);
    }
    
    this.logResults('Interview Completed', results);
    return results;
  }

  /**
   * Payment Success - User payment successful
   */
  static async notifyUserPaymentSuccess(userId: string, userName: string, amount: number, planName: string) {
    console.log('🔔 UnifiedNotificationService: User Payment Success', { userId, amount, planName });
    
    const metadata = { amount: `₹${amount}`, plan_name: planName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_payment_success', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'payment_success', metadata),
      triggerTelegramEvent('payment_success', userId, 'user', userName, metadata)
    ]);
    
    this.logResults('User Payment Success', results);
    return results;
  }

  /**
   * Payment Failed - User payment failed
   */
  static async notifyUserPaymentFailed(userId: string, userName: string, amount: number, reason: string) {
    console.log('🔔 UnifiedNotificationService: User Payment Failed', { userId, amount, reason });
    
    const metadata = { amount: `₹${amount}`, reason };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_payment_failed', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'payment_failed', metadata),
      triggerTelegramEvent('payment_failed', userId, 'user', userName, metadata)
    ]);
    
    this.logResults('User Payment Failed', results);
    return results;
  }

  /**
   * New Job Match - Matching job found for user
   */
  static async notifyNewJobMatch(userId: string, userName: string, jobTitle: string, companyName: string, jobId: string) {
    console.log('🔔 UnifiedNotificationService: New Job Match', { userId, jobTitle });
    
    const metadata = { job_title: jobTitle, company_name: companyName, job_id: jobId };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_new_job_match', userId, 'website_user', userName, metadata),
      this.sendUserWhatsApp(userId, 'new_job_match', metadata),
      triggerTelegramEvent('new_job_match', userId, 'user', userName, metadata)
    ]);
    
    this.logResults('New Job Match', results);
    return results;
  }

  // ==================== EMPLOYER EVENTS ====================

  /**
   * Employer Signup Welcome
   */
  static async notifyEmployerSignupWelcome(userId: string, companyName: string) {
    console.log('🔔 UnifiedNotificationService: Employer Signup Welcome', { userId, companyName });
    
    const metadata = { company_name: companyName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_employer_signup_welcome', userId, 'employer', companyName, metadata),
      this.sendEmployerWhatsApp(userId, 'employer_signup_welcome', metadata),
      triggerTelegramEvent('employer_signup_welcome', userId, 'employer', companyName, metadata)
    ]);
    
    this.logResults('Employer Signup Welcome', results);
    return results;
  }

  /**
   * Company Profile Complete
   */
  static async notifyCompanyProfileComplete(userId: string, companyName: string) {
    console.log('🔔 UnifiedNotificationService: Company Profile Complete', { userId, companyName });
    
    const metadata = { company_name: companyName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_company_profile_complete', userId, 'employer', companyName, metadata),
      this.sendEmployerWhatsApp(userId, 'company_profile_complete', metadata),
      triggerTelegramEvent('employer_profile_completed', userId, 'employer', companyName, metadata),
      this.triggerEmailEvent('employer_profile_completed', userId, 'employer', companyName, metadata)
    ]);
    
    this.logResults('Company Profile Complete', results);
    return results;
  }

  /**
   * Job Posted - Triggered when employer posts a new job
   */
  static async notifyJobPosted(userId: string, companyName: string, jobTitle: string) {
    console.log('🔔 UnifiedNotificationService: Job Posted', { userId, companyName, jobTitle });
    
    const metadata = { job_title: jobTitle, company_name: companyName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_job_posted', userId, 'employer', companyName, metadata),
      this.sendEmployerWhatsApp(userId, 'job_posted', metadata),
      triggerTelegramEvent('job_posted', userId, 'employer', companyName, metadata)
    ]);
    
    this.logResults('Job Posted', results);
    return results;
  }

  /**
   * New Application Received - Triggered when someone applies to employer's job
   */
  static async notifyNewApplicationReceived(userId: string, companyName: string, jobTitle: string, applicantName: string) {
    console.log('🔔 UnifiedNotificationService: New Application Received', { userId, companyName, jobTitle, applicantName });
    
    const metadata = {
      job_title: jobTitle,
      applicant_name: applicantName,
      company_name: companyName
    };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_new_application_received', userId, 'employer', companyName, metadata),
      this.sendEmployerWhatsApp(userId, 'new_application_received', metadata),
      triggerTelegramEvent('new_application_received', userId, 'employer', companyName, metadata)
    ]);
    
    this.logResults('New Application Received', results);
    return results;
  }

  /**
   * Employer Payment Success
   */
  static async notifyEmployerPaymentSuccess(userId: string, companyName: string, amount: number, planName: string) {
    console.log('🔔 UnifiedNotificationService: Employer Payment Success', { userId, amount, planName });
    
    const metadata = { amount: `₹${amount}`, plan_name: planName, company_name: companyName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_employer_payment_successful', userId, 'employer', companyName, metadata),
      this.sendEmployerWhatsApp(userId, 'employer_payment_successful', metadata),
      triggerTelegramEvent('employer_payment_successful', userId, 'employer', companyName, metadata)
    ]);
    
    this.logResults('Employer Payment Success', results);
    return results;
  }

  /**
   * Employer Payment Failed
   */
  static async notifyEmployerPaymentFailed(userId: string, companyName: string, amount: number, reason: string) {
    console.log('🔔 UnifiedNotificationService: Employer Payment Failed', { userId, amount, reason });
    
    const metadata = { amount: `₹${amount}`, reason, company_name: companyName };
    
    const results = await Promise.allSettled([
      triggerPushEvent('push_employer_payment_failed', userId, 'employer', companyName, metadata),
      this.sendEmployerWhatsApp(userId, 'employer_payment_failed', metadata),
      triggerTelegramEvent('employer_payment_failed', userId, 'employer', companyName, metadata)
    ]);
    
    this.logResults('Employer Payment Failed', results);
    return results;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get user phone and send WhatsApp notification
   */
  private static async sendUserWhatsApp(userId: string, eventType: string, metadata: Record<string, any>) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, whatsapp_number')
        .eq('user_id', userId)
        .single();

      if (!profile) return { success: false, error: 'Profile not found' };

      const phone = profile.whatsapp_number || profile.phone;
      if (!phone) return { success: false, error: 'No phone number' };

      const name = profile.full_name || 'User';
      return await triggerWhatsAppEvent(eventType, phone, name, metadata);
    } catch (error) {
      console.error('sendUserWhatsApp error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get employer phone and send WhatsApp notification
   */
  private static async sendEmployerWhatsApp(userId: string, eventType: string, metadata: Record<string, any>) {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('company_name, phone, whatsapp_number')
        .eq('user_id', userId)
        .maybeSingle();

      if (!company) return { success: false, error: 'Company not found' };

      const phone = company.whatsapp_number || company.phone;
      if (!phone) return { success: false, error: 'No phone number' };

      const name = company.company_name || 'Employer';
      return await triggerWhatsAppEvent(eventType, phone, name, metadata);
    } catch (error) {
      console.error('sendEmployerWhatsApp error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Log results for debugging
   */
  private static logResults(eventName: string, results: PromiseSettledResult<any>[]) {
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`✅ ${eventName}: ${succeeded} succeeded, ${failed} failed out of ${results.length} channels`);
    
    results.forEach((r, i) => {
      const channels = ['OneSignal', 'WhatsApp', 'Telegram'];
      if (r.status === 'rejected') {
        console.error(`❌ ${channels[i]} failed:`, r.reason);
      }
    });
  }

  // ==================== TELEGRAM CHANNEL POST ====================
  
  /**
   * Post new job to Telegram channel
   * Called when a new job is published
   */
  static async postJobToTelegramChannel(jobData: {
    job_id: string;
    title: string;
    company_name: string;
    location?: string;
    job_type?: string;
    salary_min?: number;
    salary_max?: number;
    public_slug?: string;
  }) {
    console.log('📢 UnifiedNotificationService: Posting job to Telegram channel', { jobId: jobData.job_id });
    
    try {
      const { data, error } = await supabase.functions.invoke('email-api/telegram', {
        body: { action: 'channel-post', ...jobData }
      });
      
      if (error) {
        console.error('❌ Telegram channel post error:', error);
        return { success: false, error: error.message };
      }
      
      if (data?.success) {
        console.log('✅ Job posted to Telegram channel successfully', data);
        return { success: true, messageId: data.message_id };
      } else {
        console.log('⚠️ Channel post skipped:', data?.error || 'Unknown reason');
        return { success: false, error: data?.error || 'Channel not configured' };
      }
    } catch (err: any) {
      console.error('❌ Exception posting to channel:', err);
      return { success: false, error: err.message };
    }
  }

  // ==================== EMAIL TRIGGER HELPER ====================
  
  /**
   * Trigger an email event via the email-trigger-handler edge function
   */
  static async triggerEmailEvent(eventType: string, userId: string, userType: string, name: string, metadata: Record<string, any> = {}) {
    try {
      const { data, error } = await supabase.functions.invoke('email-api/email-trigger', {
        body: {
          event_type: eventType,
          user_id: userId,
          user_type: userType,
          name,
          metadata,
          triggered_by: 'auto',
          trigger_source: 'unified-notification-service'
        }
      });
      
      if (error) {
        console.error('❌ Email trigger error:', error);
        return { success: false, error: error.message };
      }
      
      return data;
    } catch (err: any) {
      console.error('❌ Email trigger exception:', err);
      return { success: false, error: err.message };
    }
  }
}

export default UnifiedNotificationService;
