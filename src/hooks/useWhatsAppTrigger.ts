import { supabase } from '@/integrations/supabase/client';

interface TriggerEventParams {
  event_type: string;
  phone: string;
  name?: string;
  metadata?: Record<string, any>;
}

const audienceForEvent = (eventType: string) =>
  eventType.startsWith('company_') || ['new_application_received', 'job_posted'].includes(eventType)
    ? 'employer'
    : 'job_seeker';

interface TriggerResult {
  success: boolean;
  event_type: string;
  rules_executed?: number;
  results?: Array<{
    rule_id: string;
    rule_name: string;
    success: boolean;
    message_id?: string;
    error?: string;
  }>;
  error?: string;
}

export const useWhatsAppTrigger = () => {
  /**
   * Trigger a WhatsApp automation event
   * @param event_type - The type of event (e.g., 'user_signup_otp', 'application_shortlisted')
   * @param phone - Recipient phone number (with country code)
   * @param name - Recipient name (optional)
   * @param metadata - Additional data for template variables
   */
  const triggerEvent = async (
    event_type: string,
    phone: string,
    name?: string,
    metadata?: Record<string, any>
  ): Promise<TriggerResult> => {
    try {
      console.log(`🎯 Triggering WhatsApp event: ${event_type}`, { phone, name, metadata });

      // Clean phone number - ensure it has country code
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone; // Add India country code
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-cloud-api', {
        body: {
          action: 'trigger',
          audience: audienceForEvent(event_type),
          event_type,
          phone: cleanPhone,
          name: name || 'User',
          metadata: metadata || {}
        } as TriggerEventParams & { action: string }
      });

      if (error) {
        console.error(`❌ WhatsApp trigger failed for ${event_type}:`, error);
        return {
          success: false,
          event_type,
          error: error.message
        };
      }

      console.log(`✅ WhatsApp trigger completed for ${event_type}:`, data);
      return data as TriggerResult;
    } catch (err) {
      console.error(`❌ WhatsApp trigger exception for ${event_type}:`, err);
      return {
        success: false,
        event_type,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  };

  // Convenience methods for common events
  const triggerSignupOTP = async (phone: string, name: string, otp: string) => {
    return triggerEvent('user_signup_otp', phone, name, { otp });
  };

  const triggerProfileWhatsAppVerify = async (phone: string, name: string, otp: string) => {
    return triggerEvent('user_profile_whatsapp_verify', phone, name, { otp });
  };

  const triggerApplicationSubmitted = async (
    phone: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_submitted', phone, applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  const triggerApplicationShortlisted = async (
    phone: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_shortlisted', phone, applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  const triggerApplicationRejected = async (
    phone: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_rejected', phone, applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  const triggerInterviewScheduled = async (
    phone: string,
    applicantName: string,
    jobTitle: string,
    companyName: string,
    date: string,
    time: string,
    mode: string
  ) => {
    return triggerEvent('interview_scheduled', phone, applicantName, {
      job_title: jobTitle,
      company_name: companyName,
      date,
      time,
      mode
    });
  };

  const triggerPaymentSuccess = async (
    phone: string,
    name: string,
    amount: string,
    packageName: string,
    transactionId: string
  ) => {
    return triggerEvent('payment_success', phone, name, {
      amount,
      package_name: packageName,
      transaction_id: transactionId
    });
  };

  // Employer triggers
  const triggerNewApplicationReceived = async (
    phone: string,
    companyName: string,
    applicantName: string,
    jobTitle: string
  ) => {
    return triggerEvent('new_application_received', phone, companyName, {
      applicant_name: applicantName,
      job_title: jobTitle,
      company_name: companyName
    });
  };

  const triggerJobPosted = async (
    phone: string,
    companyName: string,
    jobTitle: string
  ) => {
    return triggerEvent('job_posted', phone, companyName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  // Interview related triggers
  const triggerInterviewReminder = async (
    phone: string,
    applicantName: string,
    jobTitle: string,
    time: string
  ) => {
    return triggerEvent('interview_reminder', phone, applicantName, {
      job_title: jobTitle,
      time
    });
  };

  const triggerInterviewCancelled = async (
    phone: string,
    applicantName: string,
    jobTitle: string,
    originalDate: string
  ) => {
    return triggerEvent('interview_cancelled', phone, applicantName, {
      job_title: jobTitle,
      original_date: originalDate
    });
  };

  // Application viewed trigger (for employers viewing applications)
  const triggerApplicationViewed = async (
    phone: string,
    applicantName: string,
    jobTitle: string,
    companyName: string
  ) => {
    return triggerEvent('application_viewed', phone, applicantName, {
      job_title: jobTitle,
      company_name: companyName
    });
  };

  return {
    triggerEvent,
    triggerSignupOTP,
    triggerProfileWhatsAppVerify,
    triggerApplicationSubmitted,
    triggerApplicationShortlisted,
    triggerApplicationRejected,
    triggerInterviewScheduled,
    triggerPaymentSuccess,
    triggerInterviewReminder,
    triggerInterviewCancelled,
    triggerApplicationViewed,
    // Employer triggers
    triggerNewApplicationReceived,
    triggerJobPosted
  };
};

// Standalone function for use outside React components
export const triggerWhatsAppEvent = async (
  event_type: string,
  phone: string,
  name?: string,
  metadata?: Record<string, any>
) => {
  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-cloud-api', {
      body: { action: 'trigger', audience: audienceForEvent(event_type), event_type, phone: cleanPhone, name: name || 'User', metadata: metadata || {} }
    });

    if (error) {
      console.error(`❌ WhatsApp trigger failed:`, error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    console.error(`❌ WhatsApp trigger exception:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  };
};
