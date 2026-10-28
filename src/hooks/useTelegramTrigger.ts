import { supabase } from '@/integrations/supabase/client';

interface TriggerEventParams {
  event_type: string;
  user_id?: string;
  user_type?: 'user' | 'employer';
  chat_id?: number | string;
  name?: string;
  metadata?: Record<string, any>;
  triggered_by?: 'auto' | 'manual_test' | 'system';
  trigger_source?: string;
}

interface TriggerResult {
  success: boolean;
  event_type?: string;
  processed?: number;
  sent?: number;
  failed?: number;
  results?: Array<{
    rule_id: string;
    rule_name: string;
    success: boolean;
    message_id?: number;
    chat_id?: number;
    error?: string;
  }>;
  error?: string;
}

export const useTelegramTrigger = () => {
  /**
   * Trigger a Telegram automation event
   * @param event_type - The type of event (e.g., 'application_submitted', 'interview_scheduled')
   * @param user_id - User ID to look up their telegram_chat_id
   * @param user_type - 'user' for job seekers, 'employer' for employers
   * @param name - Recipient name (optional)
   * @param metadata - Additional data for template variables
   * @param chat_id - Direct chat ID (optional, overrides user_id lookup)
   */
  const triggerEvent = async (
    event_type: string,
    user_id?: string,
    user_type: 'user' | 'employer' = 'user',
    name?: string,
    metadata?: Record<string, any>,
    chat_id?: number | string
  ): Promise<TriggerResult> => {
    try {
      console.log(`🎯 Triggering Telegram event: ${event_type}`, { user_id, user_type, name, metadata });

      const { data, error } = await supabase.functions.invoke('email-api/telegram', {
        body: {
          action: 'trigger',
          event_type,
          user_id,
          user_type,
          chat_id,
          name: name || 'User',
          metadata: metadata || {},
          triggered_by: 'auto',
          trigger_source: 'frontend'
        } as TriggerEventParams
      });

      if (error) {
        console.error(`❌ Telegram trigger failed for ${event_type}:`, error);
        return {
          success: false,
          event_type,
          error: error.message
        };
      }

      console.log(`✅ Telegram trigger completed for ${event_type}:`, data);
      return data as TriggerResult;
    } catch (err) {
      console.error(`❌ Telegram trigger exception for ${event_type}:`, err);
      return {
        success: false,
        event_type,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  };

  // =============== JOB SEEKER TRIGGERS ===============

  // Application Events
  const triggerApplicationSubmitted = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_submitted', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName,
      applicant_name: applicantName
    });
  };

  const triggerApplicationShortlisted = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_shortlisted', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  const triggerApplicationRejected = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_rejected', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  const triggerApplicationViewed = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_viewed', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  // Interview Events (Job Seeker)
  const triggerInterviewScheduled = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string,
    date: string,
    time: string,
    mode: string
  ) => {
    return triggerEvent('interview_scheduled', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName,
      date,
      time,
      mode
    });
  };

  const triggerInterviewReminder = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string,
    time: string
  ) => {
    return triggerEvent('interview_reminder', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName,
      time
    });
  };

  const triggerInterviewCancelled = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string,
    originalDate: string
  ) => {
    return triggerEvent('interview_cancelled', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName,
      original_date: originalDate
    });
  };

  const triggerInterviewCompleted = async (
    userId: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('interview_completed', userId, 'user', applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  // Payment Events (Job Seeker)
  const triggerUserPaymentSuccess = async (
    userId: string,
    userName: string,
    amount: string,
    packageName: string,
    transactionId: string
  ) => {
    return triggerEvent('user_payment_success', userId, 'user', userName, {
      amount,
      package_name: packageName,
      transaction_id: transactionId
    });
  };

  const triggerUserPaymentFailed = async (
    userId: string,
    userName: string,
    amount: string,
    reason: string
  ) => {
    return triggerEvent('user_payment_failed', userId, 'user', userName, {
      amount,
      reason
    });
  };

  // Profile & Engagement Events
  const triggerProfileViewed = async (
    userId: string,
    userName: string,
    viewerName: string,
    viewerCompany: string
  ) => {
    return triggerEvent('profile_viewed', userId, 'user', userName, {
      viewer_name: viewerName,
      viewer_company: viewerCompany
    });
  };

  const triggerProfileIncomplete = async (
    userId: string,
    userName: string,
    missingFields: string[]
  ) => {
    return triggerEvent('profile_incomplete', userId, 'user', userName, {
      missing_fields: missingFields.join(', ')
    });
  };

  const triggerJobRecommendation = async (
    userId: string,
    userName: string,
    jobTitle: string,
    companyName: string,
    location: string
  ) => {
    return triggerEvent('job_recommendation', userId, 'user', userName, {
      job_title: jobTitle,
      company_name: companyName,
      location
    });
  };

  // Referral Events (Job Seeker)
  const triggerUserReferralReward = async (
    userId: string,
    userName: string,
    rewardAmount: string,
    referredName: string
  ) => {
    return triggerEvent('user_referral_reward', userId, 'user', userName, {
      reward_amount: rewardAmount,
      referred_name: referredName
    });
  };

  // =============== EMPLOYER TRIGGERS ===============

  // Application Events (Employer)
  const triggerNewApplicationReceived = async (
    employerUserId: string,
    companyName: string,
    applicantName: string,
    jobTitle: string
  ) => {
    return triggerEvent('new_application_received', employerUserId, 'employer', companyName, {
      applicant_name: applicantName,
      job_title: jobTitle,
      company_name: companyName
    });
  };

  // Job Events (Employer)
  const triggerJobPosted = async (
    employerUserId: string,
    companyName: string,
    jobTitle: string
  ) => {
    return triggerEvent('job_posted', employerUserId, 'employer', companyName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  const triggerJobExpiring = async (
    employerUserId: string,
    companyName: string,
    jobTitle: string,
    daysRemaining: number
  ) => {
    return triggerEvent('employer_job_expiring', employerUserId, 'employer', companyName, {
      job_title: jobTitle,
      days_remaining: daysRemaining
    });
  };

  // Interview Events (Employer)
  const triggerEmployerInterviewScheduled = async (
    employerUserId: string,
    companyName: string,
    applicantName: string,
    jobTitle: string,
    date: string,
    time: string
  ) => {
    return triggerEvent('employer_interview_scheduled', employerUserId, 'employer', companyName, {
      applicant_name: applicantName,
      job_title: jobTitle,
      date,
      time
    });
  };

  const triggerEmployerInterviewReminder = async (
    employerUserId: string,
    companyName: string,
    applicantName: string,
    jobTitle: string,
    time: string
  ) => {
    return triggerEvent('employer_interview_reminder', employerUserId, 'employer', companyName, {
      applicant_name: applicantName,
      job_title: jobTitle,
      time
    });
  };

  const triggerEmployerInterviewCancelled = async (
    employerUserId: string,
    companyName: string,
    applicantName: string,
    jobTitle: string
  ) => {
    return triggerEvent('employer_interview_cancelled', employerUserId, 'employer', companyName, {
      applicant_name: applicantName,
      job_title: jobTitle
    });
  };

  const triggerEmployerInterviewCompleted = async (
    employerUserId: string,
    companyName: string,
    applicantName: string,
    jobTitle: string
  ) => {
    return triggerEvent('employer_interview_completed', employerUserId, 'employer', companyName, {
      applicant_name: applicantName,
      job_title: jobTitle
    });
  };

  // Payment Events (Employer)
  const triggerEmployerPaymentSuccess = async (
    employerUserId: string,
    companyName: string,
    amount: string,
    packageName: string,
    transactionId: string
  ) => {
    return triggerEvent('employer_payment_success', employerUserId, 'employer', companyName, {
      amount,
      package_name: packageName,
      transaction_id: transactionId
    });
  };

  const triggerEmployerPaymentFailed = async (
    employerUserId: string,
    companyName: string,
    amount: string,
    reason: string
  ) => {
    return triggerEvent('employer_payment_failed', employerUserId, 'employer', companyName, {
      amount,
      reason
    });
  };

  const triggerEmployerLowBalance = async (
    employerUserId: string,
    companyName: string,
    currentBalance: number
  ) => {
    return triggerEvent('employer_low_balance', employerUserId, 'employer', companyName, {
      current_balance: currentBalance
    });
  };

  // Profile Events (Employer)
  const triggerEmployerProfileIncomplete = async (
    employerUserId: string,
    companyName: string,
    missingFields: string[]
  ) => {
    return triggerEvent('employer_profile_incomplete', employerUserId, 'employer', companyName, {
      missing_fields: missingFields.join(', ')
    });
  };

  const triggerEmployerTelegramConnected = async (
    employerUserId: string,
    companyName: string
  ) => {
    return triggerEvent('employer_telegram_connected', employerUserId, 'employer', companyName, {});
  };

  // Referral Events (Employer)
  const triggerEmployerReferralReward = async (
    employerUserId: string,
    companyName: string,
    rewardAmount: string,
    referredName: string
  ) => {
    return triggerEvent('employer_referral_reward', employerUserId, 'employer', companyName, {
      reward_amount: rewardAmount,
      referred_name: referredName
    });
  };

  return {
    triggerEvent,
    // Job Seeker triggers
    triggerApplicationSubmitted,
    triggerApplicationShortlisted,
    triggerApplicationRejected,
    triggerApplicationViewed,
    triggerInterviewScheduled,
    triggerInterviewReminder,
    triggerInterviewCancelled,
    triggerInterviewCompleted,
    triggerUserPaymentSuccess,
    triggerUserPaymentFailed,
    triggerProfileViewed,
    triggerProfileIncomplete,
    triggerJobRecommendation,
    triggerUserReferralReward,
    // Employer triggers
    triggerNewApplicationReceived,
    triggerJobPosted,
    triggerJobExpiring,
    triggerEmployerInterviewScheduled,
    triggerEmployerInterviewReminder,
    triggerEmployerInterviewCancelled,
    triggerEmployerInterviewCompleted,
    triggerEmployerPaymentSuccess,
    triggerEmployerPaymentFailed,
    triggerEmployerLowBalance,
    triggerEmployerProfileIncomplete,
    triggerEmployerTelegramConnected,
    triggerEmployerReferralReward
  };
};

// Standalone function for use outside React components (in services, edge functions, etc.)
export const triggerTelegramEvent = async (
  event_type: string,
  user_id?: string,
  user_type: 'user' | 'employer' = 'user',
  name?: string,
  metadata?: Record<string, any>,
  chat_id?: number | string
): Promise<TriggerResult> => {
  try {
    console.log(`🎯 Triggering Telegram event (standalone): ${event_type}`, { user_id, user_type });

    const { data, error } = await supabase.functions.invoke('email-api/telegram', {
      body: {
        action: 'trigger',
        event_type,
        user_id,
        user_type,
        chat_id,
        name: name || 'User',
        metadata: metadata || {},
        triggered_by: 'auto',
        trigger_source: 'service'
      }
    });

    if (error) {
      console.error(`❌ Telegram trigger failed:`, error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    console.error(`❌ Telegram trigger exception:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
};
