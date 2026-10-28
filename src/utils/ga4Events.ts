// Enhanced Google Analytics 4 Custom Event Tracking

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// Track job application events
export const trackJobApplication = (jobId: string, jobTitle: string, companyName: string) => {
  if (window.gtag) {
    window.gtag('event', 'apply_job', {
      event_category: 'Job Applications',
      event_label: jobTitle,
      job_id: jobId,
      company_name: companyName,
      value: 1
    });
  }
};

// Track resume download events
export const trackResumeDownload = (format: string) => {
  if (window.gtag) {
    window.gtag('event', 'download_resume', {
      event_category: 'Resume',
      event_label: format,
      format: format,
      value: 1
    });
  }
};

// Track job search events
export const trackJobSearch = (query: string, filters?: any) => {
  if (window.gtag) {
    window.gtag('event', 'search', {
      event_category: 'Job Search',
      search_term: query,
      filters: JSON.stringify(filters || {}),
    });
  }
};

// Track job view events
export const trackJobView = (jobId: string, jobTitle: string) => {
  if (window.gtag) {
    window.gtag('event', 'view_job', {
      event_category: 'Job Engagement',
      event_label: jobTitle,
      job_id: jobId,
      value: 1
    });
  }
};

// Track job save/favorite events
export const trackJobSave = (jobId: string, action: 'save' | 'unsave') => {
  if (window.gtag) {
    window.gtag('event', action === 'save' ? 'save_job' : 'unsave_job', {
      event_category: 'Job Engagement',
      job_id: jobId,
      value: 1
    });
  }
};

// Track user registration events
export const trackRegistration = (method: string, userType: 'job_seeker' | 'employer') => {
  if (window.gtag) {
    window.gtag('event', 'sign_up', {
      event_category: 'User Registration',
      method: method,
      user_type: userType,
      value: 1
    });
  }
};

// Track login events
export const trackLogin = (method: string, userType: 'job_seeker' | 'employer') => {
  if (window.gtag) {
    window.gtag('event', 'login', {
      event_category: 'User Authentication',
      method: method,
      user_type: userType
    });
  }
};

// Track profile completion
export const trackProfileCompletion = (completionPercentage: number) => {
  if (window.gtag) {
    window.gtag('event', 'profile_completion', {
      event_category: 'User Profile',
      value: completionPercentage
    });
  }
};

// Track interview scheduling
export const trackInterviewScheduled = (jobId: string, interviewType: string) => {
  if (window.gtag) {
    window.gtag('event', 'schedule_interview', {
      event_category: 'Interviews',
      event_label: interviewType,
      job_id: jobId,
      value: 1
    });
  }
};

// Track skill assessment events
export const trackAssessmentStart = (assessmentType: string) => {
  if (window.gtag) {
    window.gtag('event', 'start_assessment', {
      event_category: 'Skill Assessment',
      event_label: assessmentType,
      value: 1
    });
  }
};

export const trackAssessmentComplete = (assessmentType: string, score: number) => {
  if (window.gtag) {
    window.gtag('event', 'complete_assessment', {
      event_category: 'Skill Assessment',
      event_label: assessmentType,
      score: score,
      value: 1
    });
  }
};

// Track employer post job events
export const trackJobPosting = (jobType: string, isBoost: boolean) => {
  if (window.gtag) {
    window.gtag('event', 'post_job', {
      event_category: 'Employer Actions',
      event_label: jobType,
      is_boosted: isBoost,
      value: 1
    });
  }
};

// Track payment events
export const trackPayment = (paymentType: string, amount: number, success: boolean) => {
  if (window.gtag) {
    window.gtag('event', success ? 'purchase' : 'payment_failed', {
      event_category: 'Payments',
      transaction_type: paymentType,
      value: amount,
      currency: 'INR'
    });
  }
};

// Track user journey milestones
export const trackUserJourney = (milestone: string, details?: any) => {
  if (window.gtag) {
    window.gtag('event', 'user_journey', {
      event_category: 'User Journey',
      event_label: milestone,
      ...details
    });
  }
};

// Track page engagement time
export const trackEngagement = (pageName: string, timeSpent: number) => {
  if (window.gtag) {
    window.gtag('event', 'engagement', {
      event_category: 'User Engagement',
      event_label: pageName,
      value: Math.round(timeSpent / 1000), // Convert to seconds
    });
  }
};

// Track feature usage
export const trackFeatureUsage = (featureName: string, action: string) => {
  if (window.gtag) {
    window.gtag('event', 'feature_usage', {
      event_category: 'Feature Usage',
      event_label: featureName,
      action: action,
      value: 1
    });
  }
};
