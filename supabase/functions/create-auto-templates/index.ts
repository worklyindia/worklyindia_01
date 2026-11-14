import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { CANONICAL_DOMAIN, WEBSITE_DOMAIN } from '../_shared/domain.ts';
import { graph, loadCloudConfig, toAudience } from '../_shared/whatsappCloud.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WhatsApp Template Validation Rules
// Headers CANNOT contain: emojis, asterisks, newlines, special formatting
const INVALID_HEADER_PATTERNS = [
  /[\u{1F600}-\u{1F64F}]/u, // Emoticons
  /[\u{1F300}-\u{1F5FF}]/u, // Misc Symbols and Pictographs
  /[\u{1F680}-\u{1F6FF}]/u, // Transport and Map
  /[\u{2600}-\u{26FF}]/u,   // Misc symbols
  /[\u{2700}-\u{27BF}]/u,   // Dingbats
  /[\u{FE00}-\u{FE0F}]/u,   // Variation Selectors
  /[\u{1F900}-\u{1F9FF}]/u, // Supplemental Symbols
  /[\u{1FA00}-\u{1FA6F}]/u, // Chess Symbols
  /[\u{1FA70}-\u{1FAFF}]/u, // Symbols and Pictographs Extended-A
  /[\u{231A}-\u{231B}]/u,   // Watch/Hourglass
  /[\u{23E9}-\u{23F3}]/u,   // Various symbols
  /[\u{23F8}-\u{23FA}]/u,   // Various symbols
  /[\u{25AA}-\u{25AB}]/u,   // Squares
  /[\u{25B6}]/u,            // Play button
  /[\u{25C0}]/u,            // Reverse button
  /[\u{25FB}-\u{25FE}]/u,   // Squares
  /[\u{2614}-\u{2615}]/u,   // Umbrella/Hot beverage
  /[\u{2648}-\u{2653}]/u,   // Zodiac
  /[\u{267F}]/u,            // Wheelchair
  /[\u{2693}]/u,            // Anchor
  /[\u{26A1}]/u,            // High voltage
  /[\u{26AA}-\u{26AB}]/u,   // Circles
  /[\u{26BD}-\u{26BE}]/u,   // Soccer/Baseball
  /[\u{26C4}-\u{26C5}]/u,   // Snowman/Sun
  /[\u{26CE}]/u,            // Ophiuchus
  /[\u{26D4}]/u,            // No entry
  /[\u{26EA}]/u,            // Church
  /[\u{26F2}-\u{26F3}]/u,   // Fountain/Golf
  /[\u{26F5}]/u,            // Sailboat
  /[\u{26FA}]/u,            // Tent
  /[\u{26FD}]/u,            // Fuel pump
  /[\u{2702}]/u,            // Scissors
  /[\u{2705}]/u,            // Check mark
  /[\u{2708}-\u{270D}]/u,   // Airplane to Writing hand
  /[\u{270F}]/u,            // Pencil
  /[\u{2712}]/u,            // Black nib
  /[\u{2714}]/u,            // Check mark
  /[\u{2716}]/u,            // X mark
  /[\u{271D}]/u,            // Latin cross
  /[\u{2721}]/u,            // Star of David
  /[\u{2728}]/u,            // Sparkles
  /[\u{2733}-\u{2734}]/u,   // Eight spoked asterisk
  /[\u{2744}]/u,            // Snowflake
  /[\u{2747}]/u,            // Sparkle
  /[\u{274C}]/u,            // Cross mark
  /[\u{274E}]/u,            // Cross mark
  /[\u{2753}-\u{2755}]/u,   // Question marks
  /[\u{2757}]/u,            // Exclamation mark
  /[\u{2763}-\u{2764}]/u,   // Heart exclamation
  /[\u{2795}-\u{2797}]/u,   // Plus/Minus/Division
  /[\u{27A1}]/u,            // Right arrow
  /[\u{27B0}]/u,            // Curly loop
  /[\u{27BF}]/u,            // Double curly loop
  /[\u{2934}-\u{2935}]/u,   // Arrows
  /[\u{2B05}-\u{2B07}]/u,   // Arrows
  /[\u{2B1B}-\u{2B1C}]/u,   // Squares
  /[\u{2B50}]/u,            // Star
  /[\u{2B55}]/u,            // Circle
  /[\u{3030}]/u,            // Wavy dash
  /[\u{303D}]/u,            // Part alternation mark
  /[\u{3297}]/u,            // Circled Ideograph Congratulation
  /[\u{3299}]/u,            // Circled Ideograph Secret
  /\*/g,                    // Asterisks
  /\n/g,                    // Newlines
];

// Sanitize header text for MSG91/WhatsApp compliance
const sanitizeHeaderText = (text: string): string => {
  let sanitized = text;
  INVALID_HEADER_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  return sanitized.trim();
};

// Validate header text and return issues
const validateHeaderText = (text: string): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  // Check for emojis
  if (/[\u{1F000}-\u{1FFFF}]/u.test(text) || /[\u{2600}-\u{27BF}]/u.test(text)) {
    issues.push('Contains emoji (not allowed in headers)');
  }
  
  // Check for asterisks
  if (text.includes('*')) {
    issues.push('Contains asterisk * (not allowed in headers)');
  }
  
  // Check for newlines
  if (text.includes('\n')) {
    issues.push('Contains newline (not allowed in headers)');
  }
  
  // Check length (max 60 chars for WhatsApp)
  if (text.length > 60) {
    issues.push(`Header too long (${text.length}/60 chars)`);
  }
  
  return { valid: issues.length === 0, issues };
};

// Helper to generate example values based on variable names
const getExampleValue = (varName: string): string => {
  const exampleMap: Record<string, string> = {
    'name': 'John Doe',
    'applicant_name': 'John Doe',
    'user_name': 'John Doe',
    'company_name': 'ABC Corp',
    'job_title': 'Senior Developer',
    'otp': '123456',
    'date': '15 Dec 2024',
    'time': '10:00 AM',
    'mode': 'Video Call',
    'original_date': '15 Dec 2024',
    'amount': '999',
    'package_name': 'Premium Plan',
    'transaction_id': 'TXN123456',
    'bank_info': 'HDFC Bank ****1234',
    'reason': 'As per your request',
    'salary': '₹50,000/month',
    'location': 'Remote',
    'company': 'ABC Corp',
    'new_jobs': '25',
    'matching_jobs': '10',
    'profile_views': '150',
    'top_job': 'Product Manager at Google',
    'completion_percent': '75',
    'missing_sections': 'Skills, Experience',
    'companies_hiring': '45',
    'referral_code': 'WFHREF2024',
    'reward_amount': '500',
    'referred_name': 'Jane Smith',
    'referred_company': 'XYZ Pvt Ltd',
    'total_referrals': '5',
    'applicant_count': '25',
    'jobs_count': '10',
    'active_jobs': '5',
    'new_candidates': '150',
    'matching_profiles': '35',
    'expiring_date': '20 Dec 2024',
    'missing_items': 'Logo, Description',
    'pending_count': '5',
    'interview_date': '15 Dec 2024',
  };
  return exampleMap[varName] || `Sample ${varName}`;
};

// Professional WhatsApp templates with example values
const professionalTemplates = [
  // ================== WEBSITE USER ONBOARDING ==================
  {
    event: 'user_signup_otp',
    name: 'user_signup_otp',
    category: 'AUTHENTICATION',
    content: `{{1}} is your verification code.`,
    variables: ['otp'],
    isOTP: true
  },
  {
    event: 'user_profile_whatsapp_verify',
    name: 'user_profile_whatsapp_verify',
    category: 'AUTHENTICATION',
    content: `{{1}} is your verification code.`,
    variables: ['otp'],
    isOTP: true
  },

  // ================== EMPLOYER ONBOARDING ==================
  {
    event: 'company_signup_otp',
    name: 'company_signup_otp',
    category: 'AUTHENTICATION',
    content: `{{1}} is your verification code.`,
    variables: ['otp'],
    isOTP: true
  },
  {
    event: 'company_profile_whatsapp_verify',
    name: 'company_profile_whatsapp_verify',
    category: 'AUTHENTICATION',
    content: `{{1}} is your verification code.`,
    variables: ['otp'],
    isOTP: true
  },

  // ================== WEBSITE USER APPLICATION EVENTS ==================
  {
    event: 'application_submitted',
    name: 'application_confirmation',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Application Received' },
    content: `Dear {{1}},

Your application for *{{2}}* has been successfully submitted.

*What's Next:*
• Our team will review your profile
• You'll be notified of any updates
• Track your application in the app

Good luck!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Application', url: `${WEBSITE_DOMAIN}/applications` },
      { type: 'QUICK_REPLY', text: 'Browse More Jobs' }
    ],
    variables: ['applicant_name', 'job_title']
  },
  {
    event: 'application_shortlisted',
    name: 'shortlist_congratulations',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Congratulations' },
    content: `Dear {{1}},

Great news! You've been *SHORTLISTED* for:

*Position:* {{2}}
*Company:* {{3}}

The employer was impressed with your profile and wants to move forward.

*Next Step:* Expect a call or interview invite soon!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Status', url: `${WEBSITE_DOMAIN}/applications` },
      { type: 'QUICK_REPLY', text: 'Interview Tips' }
    ],
    variables: ['applicant_name', 'job_title', 'company_name']
  },
  {
    event: 'application_rejected',
    name: 'application_status_update',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Application Update' },
    content: `Hi {{1}},

Thank you for applying to *{{2}}*.

After careful consideration, the employer has moved forward with other candidates. Don't be discouraged - the right opportunity is waiting for you!

*Tips:*
• Update your profile regularly
• Apply to similar positions
• Set up job alerts`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Browse Jobs', url: `${WEBSITE_DOMAIN}/jobs` },
      { type: 'QUICK_REPLY', text: 'Update Profile' }
    ],
    variables: ['applicant_name', 'job_title']
  },
  {
    event: 'application_viewed',
    name: 'application_viewed_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Your Application Was Viewed' },
    content: `Hi {{1}},

Great news! The employer has viewed your application for:

*{{2}}*
at {{3}}

This is a positive sign! Keep your phone accessible for potential contact.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Details', url: `${WEBSITE_DOMAIN}/applications` },
      { type: 'QUICK_REPLY', text: 'Complete Profile' }
    ],
    variables: ['applicant_name', 'job_title', 'company_name']
  },

  // ================== WEBSITE USER INTERVIEW EVENTS ==================
  {
    event: 'interview_scheduled',
    name: 'interview_confirmation',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Interview Confirmed' },
    content: `Dear {{1}},

Your interview has been scheduled:

*Position:* {{2}}
*Date:* {{3}}
*Time:* {{4}}
*Mode:* {{5}}

*Tips for success:*
• Be ready 10 minutes early
• Prepare questions about the role
• Keep your documents handy`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Details', url: `${WEBSITE_DOMAIN}/interviews` },
      { type: 'QUICK_REPLY', text: 'Add to Calendar' }
    ],
    variables: ['applicant_name', 'job_title', 'date', 'time', 'mode']
  },
  {
    event: 'interview_reminder',
    name: 'interview_reminder_1h',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Interview Reminder' },
    content: `Hi {{1}},

Your interview is starting in *1 hour*!

*Position:* {{2}}
*Time:* {{3}}

*Quick checklist:*
- Quiet environment
- Stable internet
- Professional appearance
- Resume ready

You've got this!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Join Interview', url: `${WEBSITE_DOMAIN}/interviews` },
      { type: 'QUICK_REPLY', text: 'Quick Tips' }
    ],
    variables: ['applicant_name', 'job_title', 'time']
  },
  {
    event: 'interview_completed',
    name: 'interview_feedback_request',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Interview Complete' },
    content: `Hi {{1}},

Thank you for attending the interview for *{{2}}*!

We hope it went well. Your feedback helps us improve.

The employer will share their decision soon. Stay tuned!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Rate Experience', url: `${WEBSITE_DOMAIN}/feedback` },
      { type: 'QUICK_REPLY', text: 'View More Jobs' }
    ],
    variables: ['applicant_name', 'job_title']
  },
  {
    event: 'interview_cancelled',
    name: 'interview_cancellation',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Interview Update' },
    content: `Hi {{1}},

Your interview for *{{2}}* has been *cancelled*.

Original scheduled date: {{3}}

We apologize for any inconvenience. The employer may reschedule soon.

Check the app for updates or new opportunities.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Browse Jobs', url: `${WEBSITE_DOMAIN}/jobs` },
      { type: 'QUICK_REPLY', text: 'Contact Support' }
    ],
    variables: ['applicant_name', 'job_title', 'original_date']
  },

  // ================== WEBSITE USER PAYMENT EVENTS ==================
  {
    event: 'payment_successful',
    name: 'payment_receipt',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Payment Successful' },
    content: `Hi {{1}},

Your payment has been processed:

*Amount:* Rs.{{2}}
*For:* {{3}}
*Transaction ID:* {{4}}

Thank you for your purchase!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Receipt', url: `${WEBSITE_DOMAIN}/wallet` },
      { type: 'QUICK_REPLY', text: 'Browse Jobs' }
    ],
    variables: ['user_name', 'amount', 'package_name', 'transaction_id']
  },
  {
    event: 'payment_failed',
    name: 'payment_failed_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Payment Failed' },
    content: `Hi {{1}},

Your payment of *Rs.{{2}}* could not be processed.

*Possible reasons:*
• Insufficient balance
• Bank declined
• Session timeout

Please retry or try a different payment method.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Retry Payment', url: `${WEBSITE_DOMAIN}/wallet` },
      { type: 'QUICK_REPLY', text: 'Contact Support' }
    ],
    variables: ['user_name', 'amount']
  },
  {
    event: 'withdrawal_approved',
    name: 'withdrawal_confirmation',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Withdrawal Approved' },
    content: `Hi {{1}},

Your withdrawal request has been approved:

*Amount:* Rs.{{2}}
*To:* {{3}}
*Expected:* 2-3 business days

Track status in the app.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Track Status', url: `${WEBSITE_DOMAIN}/wallet` },
      { type: 'QUICK_REPLY', text: 'View History' }
    ],
    variables: ['user_name', 'amount', 'bank_info']
  },
  {
    event: 'refund_initiated',
    name: 'refund_notification',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Refund Initiated' },
    content: `Hi {{1}},

We've initiated a refund:

*Amount:* Rs.{{2}}
*Reason:* {{3}}
*Expected:* 5-7 business days

The amount will be credited to your original payment method.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Track Refund', url: `${WEBSITE_DOMAIN}/wallet` },
      { type: 'QUICK_REPLY', text: 'Contact Support' }
    ],
    variables: ['user_name', 'amount', 'reason']
  },

  // ================== WEBSITE USER MARKETING EVENTS ==================
  {
    event: 'new_job_match',
    name: 'job_alert_match',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'New Job Match' },
    content: `Hi {{1}},

A new job matching your preferences is available:

*{{2}}*
at {{3}}
Salary: {{4}}
Location: {{5}}

This role matches your skills! Apply now before it's too late.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Apply Now', url: `${WEBSITE_DOMAIN}/jobs` },
      { type: 'QUICK_REPLY', text: 'View All Matches' }
    ],
    variables: ['user_name', 'job_title', 'company', 'salary', 'location']
  },
  {
    event: 'weekly_digest',
    name: 'weekly_job_summary',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'Weekly Job Digest' },
    content: `Hi {{1}},

Here's your weekly summary:

*New Jobs:* {{2}}
*Matching Your Profile:* {{3}}
*Profile Views:* {{4}}

Top opportunity this week:
*{{5}}*

Don't miss out - check app now!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Jobs', url: `${WEBSITE_DOMAIN}/jobs` },
      { type: 'QUICK_REPLY', text: 'Update Alerts' }
    ],
    variables: ['user_name', 'new_jobs', 'matching_jobs', 'profile_views', 'top_job']
  },
  {
    event: 'profile_incomplete',
    name: 'profile_completion_reminder',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'Complete Your Profile' },
    content: `Hi {{1}},

Your profile is *{{2}}%* complete.

Incomplete profiles get fewer views from employers!

*Missing sections:*
{{3}}

Complete now to get 3x more visibility!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Complete Now', url: `${WEBSITE_DOMAIN}/profile` },
      { type: 'QUICK_REPLY', text: 'Skip for Now' }
    ],
    variables: ['user_name', 'completion_percent', 'missing_sections']
  },
  {
    event: 'inactive_user',
    name: 'reengagement_message',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'We Miss You' },
    content: `Hey {{1}}!

It's been a while since you visited Workly India.

Since you left:
*{{2}} new jobs* posted in your field
*{{3}} companies* actively hiring

Your dream Workly India job might be waiting!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Explore Jobs', url: `${WEBSITE_DOMAIN}/jobs` },
      { type: 'QUICK_REPLY', text: 'Unsubscribe' }
    ],
    variables: ['user_name', 'new_jobs', 'companies_hiring']
  },

  // ================== WEBSITE USER REFERRAL EVENTS ==================
  {
    event: 'referral_invite',
    name: 'referral_invite_user',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'Refer and Earn' },
    content: `Hi {{1}},

Refer friends to Workly India and earn rewards!

*Your Referral Code:* {{2}}
*Reward per referral:* Rs.{{3}}

Share with friends looking for Workly India jobs!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Share Now', url: `${WEBSITE_DOMAIN}/referral` },
      { type: 'QUICK_REPLY', text: 'View Rewards' }
    ],
    variables: ['user_name', 'referral_code', 'reward_amount']
  },
  {
    event: 'referral_reward',
    name: 'referral_reward_user',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Referral Reward' },
    content: `Congratulations {{1}}!

*{{2}}* has registered using your referral!

*Reward:* Rs.{{3}}
*Total Referrals:* {{4}}

Keep referring and earning!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Wallet', url: `${WEBSITE_DOMAIN}/wallet` },
      { type: 'QUICK_REPLY', text: 'Refer More' }
    ],
    variables: ['user_name', 'referred_name', 'reward_amount', 'total_referrals']
  },

  // ================== EMPLOYER JOB POSTING EVENTS ==================
  {
    event: 'job_posted',
    name: 'job_posted_confirmation',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Job Posted Successfully' },
    content: `Hi {{1}},

Your job has been posted successfully!

*Position:* {{2}}
*Status:* Live
*Visibility:* Public

Start receiving applications from qualified candidates.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Job', url: `${WEBSITE_DOMAIN}/employer/jobs` },
      { type: 'QUICK_REPLY', text: 'Boost Job' }
    ],
    variables: ['company_name', 'job_title']
  },
  {
    event: 'job_expiring',
    name: 'job_expiring_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Job Expiring Soon' },
    content: `Hi {{1}},

Your job posting is expiring soon:

*Position:* {{2}}
*Expires:* {{3}}
*Applications:* {{4}}

Renew now to continue receiving applications!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Renew Job', url: `${WEBSITE_DOMAIN}/employer/jobs` },
      { type: 'QUICK_REPLY', text: 'View Applications' }
    ],
    variables: ['company_name', 'job_title', 'expiring_date', 'applicant_count']
  },
  {
    event: 'new_application_received',
    name: 'new_application_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'New Application Received' },
    content: `Hi {{1}},

You've received a new application:

*Position:* {{2}}
*Applicant:* {{3}}

Review their profile and take action in the app.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Application', url: `${WEBSITE_DOMAIN}/employer/applications` },
      { type: 'QUICK_REPLY', text: 'View All' }
    ],
    variables: ['company_name', 'job_title', 'applicant_name']
  },

  // ================== EMPLOYER INTERVIEW EVENTS ==================
  {
    event: 'employer_interview_scheduled',
    name: 'employer_interview_confirmation',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Interview Scheduled' },
    content: `Hi {{1}},

Interview scheduled successfully:

*Position:* {{2}}
*Candidate:* {{3}}
*Date:* {{4}}
*Time:* {{5}}

The candidate has been notified.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Details', url: `${WEBSITE_DOMAIN}/employer/interviews` },
      { type: 'QUICK_REPLY', text: 'Add to Calendar' }
    ],
    variables: ['company_name', 'job_title', 'applicant_name', 'date', 'time']
  },
  {
    event: 'employer_interview_reminder',
    name: 'employer_interview_reminder',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Interview Reminder' },
    content: `Hi {{1}},

You have an interview in 1 hour:

*Position:* {{2}}
*Candidate:* {{3}}
*Time:* {{4}}

Be ready to meet your potential hire!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Join Interview', url: `${WEBSITE_DOMAIN}/employer/interviews` },
      { type: 'QUICK_REPLY', text: 'Reschedule' }
    ],
    variables: ['company_name', 'job_title', 'applicant_name', 'time']
  },

  // ================== EMPLOYER PAYMENT EVENTS ==================
  {
    event: 'employer_payment_successful',
    name: 'employer_payment_receipt',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Payment Successful' },
    content: `Hi {{1}},

Your payment has been processed:

*Amount:* Rs.{{2}}
*For:* {{3}}
*Transaction ID:* {{4}}

Thank you for your purchase!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Receipt', url: `${WEBSITE_DOMAIN}/employer/wallet` },
      { type: 'QUICK_REPLY', text: 'Post Job' }
    ],
    variables: ['company_name', 'amount', 'package_name', 'transaction_id']
  },
  {
    event: 'employer_low_balance',
    name: 'employer_low_balance_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Low Balance Alert' },
    content: `Hi {{1}},

Your account balance is running low:

*Current Balance:* Rs.{{2}}
*Required for 1 posting:* Rs.{{3}}

Top up now to continue posting jobs!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Add Funds', url: `${WEBSITE_DOMAIN}/employer/wallet` },
      { type: 'QUICK_REPLY', text: 'View Plans' }
    ],
    variables: ['company_name', 'amount', 'required_amount']
  },
  {
    event: 'employer_withdrawal_approved',
    name: 'employer_withdrawal_confirmed',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Withdrawal Approved' },
    content: `Hi {{1}},

Your withdrawal request has been approved:

*Amount:* Rs.{{2}}
*To:* {{3}}
*Expected:* 2-3 business days`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Track Status', url: `${WEBSITE_DOMAIN}/employer/wallet` },
      { type: 'QUICK_REPLY', text: 'View History' }
    ],
    variables: ['company_name', 'amount', 'bank_info']
  },
  {
    event: 'subscription_expiring',
    name: 'subscription_expiring_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Subscription Expiring' },
    content: `Hi {{1}},

Your subscription is expiring soon:

*Plan:* {{2}}
*Expires:* {{3}}

Renew now to continue enjoying premium benefits!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Renew Now', url: `${WEBSITE_DOMAIN}/employer/subscription` },
      { type: 'QUICK_REPLY', text: 'View Plans' }
    ],
    variables: ['company_name', 'package_name', 'expiring_date']
  },

  // ================== EMPLOYER MARKETING EVENTS ==================
  {
    event: 'employer_profile_incomplete',
    name: 'employer_profile_reminder',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'Complete Your Profile' },
    content: `Hi {{1}},

Your company profile is *{{2}}%* complete.

Complete profiles get 3x more applications!

*Missing:*
{{3}}

Complete now to attract top talent!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Complete Now', url: `${WEBSITE_DOMAIN}/employer/profile` },
      { type: 'QUICK_REPLY', text: 'Skip for Now' }
    ],
    variables: ['company_name', 'completion_percent', 'missing_items']
  },
  {
    event: 'employer_inactive',
    name: 'employer_reengagement',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'We Miss You' },
    content: `Hi {{1}}!

It's been a while since you logged in.

*Since you left:*
• {{2}} new candidates in your industry
• {{3}} profiles matching your requirements

Find your next hire today!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Explore Candidates', url: `${WEBSITE_DOMAIN}/employer` },
      { type: 'QUICK_REPLY', text: 'Unsubscribe' }
    ],
    variables: ['company_name', 'new_candidates', 'matching_profiles']
  },

  // ================== EMPLOYER REFERRAL EVENTS ==================
  {
    event: 'employer_referral_invite',
    name: 'employer_referral_invite',
    category: 'MARKETING',
    header: { type: 'TEXT', text: 'Refer and Earn' },
    content: `Hi {{1}},

Refer companies to Workly India and earn rewards!

*Your Referral Code:* {{2}}
*Reward per referral:* Rs.{{3}}

Share this code with other employers!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Share Now', url: `${WEBSITE_DOMAIN}/employer/referral` },
      { type: 'QUICK_REPLY', text: 'View Rewards' }
    ],
    variables: ['company_name', 'referral_code', 'reward_amount']
  },
  {
    event: 'employer_referral_reward',
    name: 'employer_referral_reward',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Referral Reward' },
    content: `Congratulations {{1}}!

*{{2}}* has registered using your referral!

*Reward:* Rs.{{3}}
*Total Referrals:* {{4}}

Keep referring and earning!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'View Wallet', url: `${WEBSITE_DOMAIN}/employer/wallet` },
      { type: 'QUICK_REPLY', text: 'Refer More' }
    ],
    variables: ['company_name', 'referred_company', 'reward_amount', 'total_referrals']
  },

  // ================== 4 MISSING TRIGGERS TEMPLATES ==================
  {
    event: 'candidate_shortlisted',
    name: 'candidate_shortlisted_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Candidate Shortlisted' },
    content: `Hi {{1}},

You have successfully shortlisted:

*Candidate:* {{2}}
*Position:* {{3}}

*Next Steps:*
• Schedule an interview
• Review candidate profile
• Contact candidate directly`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Schedule Interview', url: `${WEBSITE_DOMAIN}/employer/interviews` },
      { type: 'QUICK_REPLY', text: 'View Profile' }
    ],
    variables: ['company_name', 'applicant_name', 'job_title']
  },
  {
    event: 'employer_payment_failed',
    name: 'employer_payment_failed_alert',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Payment Failed' },
    content: `Hi {{1}},

Your payment of *Rs.{{2}}* could not be processed.

*Possible reasons:*
• Insufficient balance
• Bank declined
• Session timeout

Please retry or try a different payment method.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Retry Payment', url: `${WEBSITE_DOMAIN}/employer/wallet` },
      { type: 'QUICK_REPLY', text: 'Contact Support' }
    ],
    variables: ['company_name', 'amount']
  },
  {
    event: 'interview_feedback_employer',
    name: 'interview_feedback_employer_reminder',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Feedback Required' },
    content: `Hi {{1}},

Please provide feedback for the recent interview:

*Candidate:* {{2}}
*Position:* {{3}}
*Interview Date:* {{4}}

Your feedback helps us improve the hiring process.`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Submit Feedback', url: `${WEBSITE_DOMAIN}/employer/interviews` },
      { type: 'QUICK_REPLY', text: 'Skip' }
    ],
    variables: ['company_name', 'applicant_name', 'job_title', 'interview_date']
  },
  {
    event: 'interview_to_schedule',
    name: 'interview_schedule_reminder',
    category: 'UTILITY',
    header: { type: 'TEXT', text: 'Schedule Interview' },
    content: `Hi {{1}},

You have shortlisted candidates waiting for interview:

*Position:* {{2}}
*Pending Interviews:* {{3}}

Schedule interviews now to keep candidates engaged!`,
    footer: `Workly India • ${CANONICAL_DOMAIN}`,
    buttons: [
      { type: 'URL', text: 'Schedule Now', url: `${WEBSITE_DOMAIN}/employer/interviews` },
      { type: 'QUICK_REPLY', text: 'View Candidates' }
    ],
    variables: ['company_name', 'job_title', 'pending_count']
  }
];

// Event to template name mapping for linking
const eventToTemplateName: Record<string, string> = {};
professionalTemplates.forEach(t => {
  eventToTemplateName[t.event] = t.name;
});

// Build MSG91 components with proper example values
const buildMSG91Components = (template: any): any[] => {
  const components: any[] = [];
  const isAuthTemplate = template.category.toUpperCase() === 'AUTHENTICATION';

  if (isAuthTemplate) {
    // AUTHENTICATION templates use special WhatsApp Business API format
    components.push({
      type: 'BODY',
      add_security_recommendation: true
    });
    components.push({
      type: 'FOOTER',
      code_expiration_minutes: 10
    });
    // Meta one-tap autofill is enabled only when the release signing hash
    // has been configured. Without it, retain the safe Copy Code fallback.
    const appSignatureHash = (Deno.env.get('WORKLY_WHATSAPP_OTP_SIGNATURE_HASH') || '').trim();
    const otpButton: Record<string, unknown> = {
      type: 'OTP',
      otp_type: appSignatureHash ? 'ONE_TAP' : 'COPY_CODE',
      text: 'Copy Code',
    };
    if (appSignatureHash) {
      otpButton.autofill_text = 'Autofill';
      otpButton.supported_apps = [{
        package_name: 'com.worklyindia.app',
        signature_hash: appSignatureHash,
      }];
    }
    components.push({
      type: 'BUTTONS',
      buttons: [otpButton],
    });
  } else {
    // HEADER component
    if (template.header?.type === 'TEXT') {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: template.header.text
      });
    }

    // BODY component with example values
    const bodyComponent: any = {
      type: 'BODY',
      text: template.content
    };

    // Add example values for body variables
    if (template.variables && template.variables.length > 0) {
      const exampleValues = template.variables.map((v: string) => getExampleValue(v));
      bodyComponent.example = {
        body_text: [exampleValues]
      };
    }
    components.push(bodyComponent);

    // FOOTER component
    if (template.footer) {
      components.push({
        type: 'FOOTER',
        text: template.footer
      });
    }

    // BUTTONS component
    if (template.buttons && template.buttons.length > 0) {
      const buttonComponents = template.buttons.map((btn: any) => {
        if (btn.type === 'URL') {
          return {
            type: 'URL',
            text: btn.text,
            url: btn.url
          };
        } else if (btn.type === 'PHONE_NUMBER') {
          return {
            type: 'PHONE_NUMBER',
            text: btn.text,
            phone_number: btn.phone_number
          };
        } else {
          return {
            type: 'QUICK_REPLY',
            text: btn.text
          };
        }
      });

      components.push({
        type: 'BUTTONS',
        buttons: buttonComponents
      });
    }
  }

  return components;
};

// Submit template to WhatsApp Cloud API (Meta)
const submitToMeta = async (
  template: any,
  templateName: string,
  _token: string,
  wabaId: string
): Promise<{ success: boolean; data?: any; error?: string; isCooldown?: boolean; errorType?: string }> => {
  try {
    const components = buildMSG91Components(template);
    console.log(`📤 Submitting to Meta: ${templateName}`);

    const result = await graph(`/${wabaId}/message_templates`, {
      method: 'POST',
      body: {
        name: templateName,
        category: String(template.category || 'UTILITY').toUpperCase(),
        language: 'en_US',
        components,
      },
    }, _token);

    return { success: true, data: { ...result, template_id: result.id } };
  } catch (error: any) {
    const errorStr = error?.message || 'Unknown error';
    console.error(`❌ Meta error for ${templateName}:`, errorStr);
    const cooldownKeywords = ['deleted', 'cooldown', '4 week', 'being deleted', 'cannot be created', 'already exists'];
    const isCooldown = cooldownKeywords.some((k) => errorStr.toLowerCase().includes(k));
    if (isCooldown) return { success: false, error: errorStr, isCooldown: true, errorType: 'cooldown', data: error?.details };
    const formatKeywords = ['category', 'invalid', 'format', 'header', 'button', 'component'];
    if (formatKeywords.some((k) => errorStr.toLowerCase().includes(k))) {
      return { success: false, error: errorStr, isCooldown: false, errorType: 'format', data: error?.details };
    }
    return { success: false, error: errorStr, data: error?.details };
  }
};

// Edit an existing template via WhatsApp Cloud API (Meta)
const editMetaTemplate = async (
  template: any,
  metaTemplateId: string,
  _token: string,
  _wabaId: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const components = buildMSG91Components(template);
    console.log(`✏️ Editing template in Meta: ${metaTemplateId}`);
    const result = await graph(`/${metaTemplateId}`, { method: 'POST', body: { components } }, _token);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('❌ Meta edit error:', error?.message);
    return { success: false, error: error?.message || 'Edit failed', data: error?.details };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, events, event, user_id, template_ids, audience: audienceValue } = await req.json();
    const cloudConfig = await loadCloudConfig(false, toAudience(audienceValue));
    const cloudAccessToken = cloudConfig.token;
    const cloudWabaId = cloudConfig.wabaId;
    
    console.log('🚀 Create auto templates request:', { action, events, event, user_id });

    // ==================== CREATE_ALL ACTION ====================
    if (action === 'create_all') {
      const results = [];
      const templatesToProcess = events 
        ? professionalTemplates.filter(t => events.includes(t.event))
        : professionalTemplates;
      
      console.log(`📝 Processing ${templatesToProcess.length} templates...`);
      
      for (const template of templatesToProcess) {
        try {
          // Check if template already exists (including versioned names like _v2, _v3)
          const { data: existingTemplates } = await supabase
            .from('whatsapp_templates')
            .select('id, name, status, msg91_template_id')
            .or(`name.eq.${template.name},name.like.${template.name}_v%`);
          
          // Find if any approved template exists (skip recreation)
          const approvedTemplate = existingTemplates?.find(t => t.status === 'APPROVED');
          if (approvedTemplate) {
            const appSignatureHash = (Deno.env.get('WORKLY_WHATSAPP_OTP_SIGNATURE_HASH') || '').trim();
            // Existing approved OTP templates must be resubmitted with the one-tap
            // button once the release signing hash is configured. Meta approval is
            // required again, so mark the row pending and pause OTP sends until approved.
            if (template.isOTP && appSignatureHash && approvedTemplate.msg91_template_id && cloudAccessToken && cloudWabaId) {
              const refreshResult = await editMetaTemplate(template, approvedTemplate.msg91_template_id, cloudAccessToken, cloudWabaId);
              if (refreshResult.success) {
                await supabase.from('whatsapp_templates')
                  .update({ status: 'PENDING', rejection_reason: null })
                  .eq('id', approvedTemplate.id);
                results.push({
                  event: template.event,
                  name: approvedTemplate.name,
                  status: 'resubmitted_for_one_tap',
                  templateId: approvedTemplate.id,
                  templateStatus: 'PENDING'
                });
                continue;
              }
              results.push({
                event: template.event,
                name: approvedTemplate.name,
                status: 'one_tap_update_failed',
                templateId: approvedTemplate.id,
                templateStatus: 'APPROVED',
                error: refreshResult.error || 'Meta rejected the one-tap template update'
              });
              continue;
            }
            console.log(`✅ Template already APPROVED: ${approvedTemplate.name} - SKIPPING`);
            results.push({
              event: template.event,
              name: approvedTemplate.name,
              status: 'approved_exists',
              templateId: approvedTemplate.id,
              templateStatus: 'APPROVED',
              oneTapReady: Boolean(appSignatureHash && template.isOTP)
            });
            continue;
          }
          
          // Check if any version exists (not approved)
          const existing = existingTemplates?.[0];
          if (existing) {
            console.log(`ℹ️ Template exists (${existing.status}): ${existing.name}`);
            results.push({
              event: template.event,
              name: existing.name,
              status: 'exists',
              templateId: existing.id,
              templateStatus: existing.status
            });
            continue;
          }
          
          // Create template in database
          const { data: newTemplate, error: dbError } = await supabase
            .from('whatsapp_templates')
            .insert({
              name: template.name,
              display_name: template.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              category: template.category,
              content_preview: template.content,
              variables: template.variables,
              header_type: template.header?.type || null,
              header_content: template.header?.text || null,
              footer: template.footer || null,
              buttons: template.buttons || null,
              status: 'PENDING',
              is_active: true,
              language: 'en'
            })
            .select()
            .single();
          
          if (dbError) {
            console.error('❌ DB Error for template:', template.name, dbError);
            results.push({
              event: template.event,
              name: template.name,
              status: 'error',
              error: dbError.message
            });
            continue;
          }
          
          console.log(`✅ Created template in DB: ${template.name} (ID: ${newTemplate.id})`);
          
          // Submit to Meta if this audience is connected
          if (cloudAccessToken && cloudWabaId) {
            let templateName = template.name;
            let metaResult = await submitToMeta(template, templateName, cloudAccessToken, cloudWabaId);
            
            // Handle cooldown - try versioned names
            if (metaResult.isCooldown) {
              console.log(`⏳ Cooldown detected for ${template.name}, trying versioned names...`);
              for (let version = 2; version <= 5; version++) {
                templateName = `${template.name}_v${version}`;
                console.log(`🔄 Trying: ${templateName}`);
                metaResult = await submitToMeta(template, templateName, cloudAccessToken, cloudWabaId);
                if (!metaResult.isCooldown) break;
              }
            }
            
            if (metaResult.success) {
              await supabase
                .from('whatsapp_templates')
                .update({ 
                  msg91_template_id: metaResult.data.template_id || metaResult.data.id,
                  name: templateName, // Update with versioned name if changed
                  status: 'PENDING'
                })
                .eq('id', newTemplate.id);
              
              results.push({
                event: template.event,
                name: templateName,
                status: 'submitted',
                templateId: newTemplate.id,
                metaStatus: 'submitted'
              });
            } else {
              // Store error details
              await supabase
                .from('whatsapp_templates')
                .update({ 
                  status: 'REJECTED',
                  rejection_reason: metaResult.error
                })
                .eq('id', newTemplate.id);
              
              results.push({
                event: template.event,
                name: template.name,
                status: 'error',
                templateId: newTemplate.id,
                error: metaResult.error,
                isCooldown: metaResult.isCooldown
              });
            }
          } else {
            console.log(`ℹ️ Meta Cloud API is not connected for this audience, template saved locally: ${template.name}`);
            results.push({
              event: template.event,
              name: template.name,
              status: 'created_locally',
              templateId: newTemplate.id,
              note: 'Meta Cloud API is not connected for this audience'
            });
          }
        } catch (error) {
          console.error('❌ Error processing template:', template.name, error);
          results.push({
            event: template.event,
            name: template.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      console.log(`✅ Template creation complete. Results: ${results.length} processed`);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Processed ${results.length} templates`,
        results,
        cloudConfigured: !!(cloudAccessToken && cloudWabaId)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== FIX_REJECTED ACTION ====================
    if (action === 'fix_rejected') {
      const results = [];
      
      // Get all rejected templates
      let query = supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('status', 'REJECTED');
      
      if (template_ids && template_ids.length > 0) {
        query = query.in('id', template_ids);
      }
      
      const { data: rejectedTemplates, error: fetchError } = await query;
      
      if (fetchError) {
        return new Response(JSON.stringify({
          success: false,
          error: fetchError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`🔧 Fixing ${rejectedTemplates?.length || 0} rejected templates...`);
      
      for (const dbTemplate of rejectedTemplates || []) {
        try {
          // Find the matching professional template
          const template = professionalTemplates.find(t => t.name === dbTemplate.name || t.name === dbTemplate.name.replace(/_v\d+$/, ''));
          
          if (!template) {
            console.log(`⚠️ No matching template definition for: ${dbTemplate.name}`);
            results.push({
              templateId: dbTemplate.id,
              name: dbTemplate.name,
              status: 'skipped',
              reason: 'No matching template definition'
            });
            continue;
          }
          
          if (!cloudAccessToken || !cloudWabaId) {
            results.push({
              templateId: dbTemplate.id,
              name: dbTemplate.name,
              status: 'error',
              error: 'Meta Cloud API is not connected for this audience'
            });
            continue;
          }
          
          // If template has MSG91 ID, try to edit it
          if (dbTemplate.msg91_template_id) {
            console.log(`✏️ Editing rejected template: ${dbTemplate.name}`);
            const editResult = await editMetaTemplate(template, dbTemplate.msg91_template_id, cloudAccessToken, cloudWabaId);
            
            if (editResult.success) {
              await supabase
                .from('whatsapp_templates')
                .update({ 
                  status: 'PENDING',
                  rejection_reason: null,
                  content_preview: template.content,
                  variables: template.variables
                })
                .eq('id', dbTemplate.id);
              
              results.push({
                templateId: dbTemplate.id,
                name: dbTemplate.name,
                status: 'edited',
                msg91Result: editResult.data
              });
            } else {
              // Edit failed, try creating new version
              console.log(`⚠️ Edit failed, creating new version for: ${dbTemplate.name}`);
              let newName = dbTemplate.name;
              let createResult;
              
              for (let version = 2; version <= 5; version++) {
                newName = `${template.name}_v${version}`;
                
                // Check if this version exists
                const { data: existing } = await supabase
                  .from('whatsapp_templates')
                  .select('id')
                  .eq('name', newName)
                  .single();
                
                if (existing) continue;
                
                createResult = await submitToMeta(template, newName, cloudAccessToken, cloudWabaId);
                if (createResult.success) break;
              }
              
              if (createResult?.success) {
                // Create new template entry
                const { data: newDbTemplate } = await supabase
                  .from('whatsapp_templates')
                  .insert({
                    name: newName,
                    display_name: newName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    category: template.category,
                    content_preview: template.content,
                    variables: template.variables,
                    header_type: template.header?.type || null,
                    header_content: template.header?.text || null,
                    footer: template.footer || null,
                    buttons: template.buttons || null,
                    msg91_template_id: createResult.data.template_id || createResult.data.id,
                    status: 'PENDING',
                    is_active: true,
                    language: 'en'
                  })
                  .select()
                  .single();
                
                results.push({
                  templateId: dbTemplate.id,
                  name: dbTemplate.name,
                  status: 'created_new_version',
                  newName,
                  newTemplateId: newDbTemplate?.id
                });
              } else {
                results.push({
                  templateId: dbTemplate.id,
                  name: dbTemplate.name,
                  status: 'error',
                  error: createResult?.error || editResult.error
                });
              }
            }
          } else {
            // No MSG91 ID, create new submission
            let templateName = dbTemplate.name;
            let createResult = await submitToMeta(template, templateName, cloudAccessToken, cloudWabaId);
            
            if (createResult.isCooldown) {
              for (let version = 2; version <= 5; version++) {
                templateName = `${template.name}_v${version}`;
                createResult = await submitToMeta(template, templateName, cloudAccessToken, cloudWabaId);
                if (!createResult.isCooldown) break;
              }
            }
            
            if (createResult.success) {
              await supabase
                .from('whatsapp_templates')
                .update({ 
                  name: templateName,
                  msg91_template_id: createResult.data.template_id || createResult.data.id,
                  status: 'PENDING',
                  rejection_reason: null
                })
                .eq('id', dbTemplate.id);
              
              results.push({
                templateId: dbTemplate.id,
                name: templateName,
                status: 'resubmitted'
              });
            } else {
              results.push({
                templateId: dbTemplate.id,
                name: dbTemplate.name,
                status: 'error',
                error: createResult.error
              });
            }
          }
        } catch (error) {
          console.error(`❌ Error fixing template ${dbTemplate.name}:`, error);
          results.push({
            templateId: dbTemplate.id,
            name: dbTemplate.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: `Processed ${results.length} rejected templates`,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== LINK_TRIGGERS ACTION ====================
    if (action === 'link_triggers') {
      const results = [];
      
      console.log('🔗 Starting trigger linking process...');
      
      for (const template of professionalTemplates) {
        try {
          // Find the template in DB (check for versioned names too)
          let dbTemplate;
          const { data: exactMatch } = await supabase
            .from('whatsapp_templates')
            .select('id, status, name')
            .eq('name', template.name)
            .single();
          
          if (exactMatch) {
            dbTemplate = exactMatch;
          } else {
            // Try versioned names
            const { data: versionedMatch } = await supabase
              .from('whatsapp_templates')
              .select('id, status, name')
              .like('name', `${template.name}_v%`)
              .order('name', { ascending: false })
              .limit(1)
              .single();
            
            dbTemplate = versionedMatch;
          }
          
          if (!dbTemplate) {
            console.log(`⚠️ Template not found in DB: ${template.name}`);
            continue;
          }
          
          console.log(`📝 Processing trigger for event: ${template.event} -> template: ${dbTemplate.name} (${dbTemplate.id})`);
          
          // Find the trigger for this event
          const { data: existingTrigger, error: triggerError } = await supabase
            .from('whatsapp_automation_rules')
            .select('id, template_id, name')
            .eq('trigger_event', template.event)
            .single();
          
          if (triggerError && triggerError.code !== 'PGRST116') {
            console.error(`❌ Error finding trigger for ${template.event}:`, triggerError);
            continue;
          }
          
          // Build variable mapping
          const variableMapping: Record<string, string> = {};
          const isAuthTemplate = template.category.toUpperCase() === 'AUTHENTICATION';
          
          if (isAuthTemplate) {
            variableMapping['body_1'] = 'otp';
            variableMapping['button_1'] = 'otp';
          } else if (template.variables && template.variables.length > 0) {
            template.variables.forEach((varName: string, index: number) => {
              variableMapping[`body_${index + 1}`] = varName;
            });
          }
          
          if (existingTrigger) {
            const currentTemplateId = existingTrigger.template_id;
            
            if (currentTemplateId !== dbTemplate.id) {
              console.log(`🔄 Updating trigger ${existingTrigger.name}: ${currentTemplateId} -> ${dbTemplate.id}`);
              
              const { error: updateError } = await supabase
                .from('whatsapp_automation_rules')
                .update({ 
                  template_id: dbTemplate.id,
                  variable_mapping: variableMapping 
                })
                .eq('id', existingTrigger.id);
              
              if (updateError) {
                console.error(`❌ Error updating trigger:`, updateError);
                results.push({
                  event: template.event,
                  action: 'error',
                  error: updateError.message
                });
              } else {
                results.push({
                  event: template.event,
                  action: 'updated',
                  triggerId: existingTrigger.id,
                  templateId: dbTemplate.id
                });
              }
            } else {
              // Update variable mapping anyway
              await supabase
                .from('whatsapp_automation_rules')
                .update({ variable_mapping: variableMapping })
                .eq('id', existingTrigger.id);
              
              results.push({
                event: template.event,
                action: 'already_linked',
                triggerId: existingTrigger.id,
                templateId: dbTemplate.id
              });
            }
          } else {
            // Create new trigger
            console.log(`➕ Creating new trigger for event: ${template.event}`);
            
            const triggerName = template.event
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            const { data: newTrigger, error: insertError } = await supabase
              .from('whatsapp_automation_rules')
              .insert({
                name: triggerName,
                description: `Auto-trigger for ${triggerName}`,
                trigger_event: template.event,
                template_id: dbTemplate.id,
                delay_minutes: 0,
                is_active: false,
                trigger_conditions: {},
                variable_mapping: variableMapping,
                created_by: user_id || null
              })
              .select()
              .single();
            
            if (insertError) {
              console.error(`❌ Error creating trigger:`, insertError);
              results.push({
                event: template.event,
                action: 'error',
                error: insertError.message
              });
            } else {
              results.push({
                event: template.event,
                action: 'created',
                triggerId: newTrigger.id,
                templateId: dbTemplate.id
              });
            }
          }
        } catch (error) {
          console.error(`❌ Error processing ${template.event}:`, error);
          results.push({
            event: template.event,
            action: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: `Processed ${results.length} triggers`,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== CHECK_STATUS ACTION ====================
    if (action === 'check_status') {
      const cloudConfigured = !!(cloudAccessToken && cloudWabaId);
      
      const { count: templateCount } = await supabase
        .from('whatsapp_templates')
        .select('*', { count: 'exact', head: true });
      
      const { count: triggerCount } = await supabase
        .from('whatsapp_automation_rules')
        .select('*', { count: 'exact', head: true });
      
      const { count: activeTriggerCount } = await supabase
        .from('whatsapp_automation_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      const { count: rejectedCount } = await supabase
        .from('whatsapp_templates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'REJECTED');
      
      return new Response(JSON.stringify({
        success: true,
        cloudConfigured,
        templateCount: templateCount || 0,
        triggerCount: triggerCount || 0,
        activeTriggerCount: activeTriggerCount || 0,
        rejectedCount: rejectedCount || 0,
        availableTemplates: professionalTemplates.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== GET_TEMPLATE_LIST ACTION ====================
    if (action === 'get_template_list') {
      return new Response(JSON.stringify({
        success: true,
        templates: professionalTemplates.map(t => ({
          event: t.event,
          name: t.name,
          category: t.category,
          variables: t.variables,
          contentPreview: t.content.substring(0, 100) + '...'
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action. Use: create_all, fix_rejected, link_triggers, get_template_list, or check_status'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
