/**
 * Catalog of every push notification the app can send.
 * Each entry can be customised from Owner Portal → Push Templates.
 * The `key` must match the event_type / data.type sent to
 * email-api so the server can apply the template.
 *
 * `variables` lists the placeholders usable inside title / message / button.
 * Placeholders use the {{key}} syntax and are replaced with real data when the
 * push is sent. The `sample` value is used by the "Send test to me" button.
 */

import { EMAIL_CONTENT_SPECS } from './emailTemplateContent';
import { emailTemplateFromSpec } from './emailTemplateDesign';
import { PAYMENT_EMAIL_DEFAULTS, PAYMENT_EMAIL_VARIABLES, PAYPAL_EMAIL_DEFAULTS, PAYPAL_EMAIL_VARIABLES } from './paymentEmailTemplates';


export interface PushTemplateVariable {
  key: string;
  label: string;
  sample: string;
}

export type TemplateAudience = 'job_seeker' | 'employer' | 'both';

export interface PushTemplateDef {
  key: string;
  label: string;
  description: string;
  /** Which Telegram bot / audience this message belongs to. */
  audience?: TemplateAudience;
  /** Hidden from the Email channel (push/Telegram only). */
  noEmail?: boolean;
  /** Only shown on the Telegram templates screen (channel-only messages). */
  telegramOnly?: boolean;
  /** Only shown on the Email templates screen. */
  emailOnly?: boolean;
  variables: PushTemplateVariable[];
  defaults: {
    title: string;
    body: string;
    button_text: string;
    button_url: string;
  };
}

export interface PushTemplateGroup {
  id: string;
  label: string;
  events: PushTemplateDef[];
}

/** A template with no audience set belongs to both bots. */
export const audienceOf = (def: PushTemplateDef): TemplateAudience => def.audience ?? 'both';

/** Date + time are available in every template. */
export const COMMON_VARIABLES: PushTemplateVariable[] = [
  { key: 'date', label: 'Date (DD Month YYYY)', sample: '22 September 2026' },
  { key: 'time', label: 'Time (HH:MM:SS AM/PM)', sample: '05:37:20 PM' },
];

const V = {
  name: { key: 'name', label: 'Name', sample: 'Rahul Kumar' },
  mobile: { key: 'mobile', label: 'Mobile', sample: '+91 98765 43210' },
  whatsapp: { key: 'whatsapp', label: 'WhatsApp', sample: '+91 98765 43210' },
  email: { key: 'email', label: 'Email', sample: 'rahul@example.com' },
  location: { key: 'location', label: 'Location', sample: 'Mumbai, Maharashtra' },
  job_title: { key: 'job_title', label: 'Job title', sample: 'Frontend Developer' },
  company: { key: 'company', label: 'Company', sample: 'Workly India' },
  status: { key: 'status', label: 'Status', sample: 'Shortlisted' },
  interview_date: { key: 'interview_date', label: 'Interview date', sample: '18/09/2026' },
  interview_time: { key: 'interview_time', label: 'Interview time', sample: '11:30:00 AM' },
  mode: { key: 'mode', label: 'Interview mode', sample: 'Video call' },
  amount: { key: 'amount', label: 'Amount', sample: '₹499' },
  points: { key: 'points', label: 'Points', sample: '500' },
  balance: { key: 'balance', label: 'Balance', sample: '1,250' },
  order_id: { key: 'order_id', label: 'Order ID', sample: 'ORD-20260915-1042' },
  referral_name: { key: 'referral_name', label: 'Referral name', sample: 'Priya Sharma' },
  rank: { key: 'rank', label: 'Rank', sample: '1' },
  prize: { key: 'prize', label: 'Prize', sample: '₹5,000' },
  expiry_date: { key: 'expiry_date', label: 'Expiry date', sample: '20/09/2026' },
  domain: { key: 'domain', label: 'Domain', sample: 'worklyindia.com' },
  plan: { key: 'plan', label: 'Plan name', sample: 'AI Pro Monthly' },
  otp: { key: 'otp', label: 'OTP code', sample: '482913' },
  expiry_minutes: { key: 'expiry_minutes', label: 'Expiry minutes', sample: '5' },
  job_type: { key: 'job_type', label: 'Job type', sample: 'Full Time' },
  salary: { key: 'salary', label: 'Salary', sample: '₹18K - ₹35K' },
  job_url: { key: 'job_url', label: 'Job link', sample: 'https://worklyindia.devs.surf/job/frontend-developer' },
  post_date: { key: 'post_date', label: 'Post date', sample: '22 September 2026' },
  post_time: { key: 'post_time', label: 'Post time', sample: '05:37 PM IST' },
  reason: { key: 'reason', label: 'Reason', sample: 'Violation of platform guidelines' },
  job_count: { key: 'job_count', label: 'Number of matching jobs', sample: '10' },
  jobs_list: { key: 'jobs_list', label: 'Matching jobs list', sample: '1. Frontend Developer — Workly India — Mumbai' },
  resume_templates: { key: 'resume_templates', label: 'Resume templates gallery', sample: 'Professional, ATS Simple, Modern…' },
  cover_templates: { key: 'cover_templates', label: 'Cover letter templates gallery', sample: 'Premium, ATS Professional, Modern…' },
  developer_services: { key: 'developer_services', label: 'Developer services list', sample: 'Jobs API, Email API, WhatsApp API…' },
  confirm_link: {
    key: 'confirm_link',
    label: 'Verification link',
    sample: 'https://jubwzelupbntbetpajqb.supabase.co/auth/v1/verify?token=abc123&type=signup&redirect_to=https://worklyindia.devs.surf/',
  },
  new_email: { key: 'new_email', label: 'New email address', sample: 'new@example.com' },
  old_email: { key: 'old_email', label: 'Current email address', sample: 'old@example.com' },
} satisfies Record<string, PushTemplateVariable>;

export const PUSH_TEMPLATE_GROUPS: PushTemplateGroup[] = [
  {
    id: 'lifecycle',
    label: 'Connect / Disconnect notification',
    events: [
      {
        key: 'subscribe',
        label: 'Connect Notification',
        description: 'Sent when a user turns notifications ON / connects.',
        variables: [V.name],
        defaults: {
          title: '🔔 Notifications Connected',
          body: 'Hi {{name}}, your notifications are now ON. Jobs, hiring updates and important alerts will arrive here.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Explore Now',
          button_url: '/jobs',
        },
      },
      {
        key: 'unsubscribe',
        label: 'Disconnect Notification',
        description: 'Sent when a user turns notifications OFF / disconnects.',
        variables: [V.name],
        defaults: {
          title: '🔕 Notifications Disconnected',
          body: 'Hi {{name}}, your notifications are now OFF. You may miss job alerts — you can turn them back on anytime.\nDate : {{date}}\nTime : {{time}}',

          button_text: 'Turn On',
          button_url: '/notifications',
        },
      },
      {
        key: 'email_notifications_on',
        audience: 'job_seeker',
        emailOnly: true,
        label: 'Email notifications turned ON (job seeker)',
        description: 'Sent to a job seeker who turns the Email Notifications switch ON in Settings.',
        variables: [V.name, V.email],
        defaults: {
          title: 'Email notifications are now ON',
          body: 'Hi {{name}},\n\nEmail notifications for your Workly India job seeker account are now switched ON.\n\nSetting details\nAccount email: {{email}}\nChannel: Email\nStatus: Turned ON\nUpdated on: {{date}} at {{time}}\n\nWhat you will receive on this email\n• New jobs that match your skills, experience and preferred location.\n• Every update on your applications — reviewed, shortlisted, interview scheduled, hired or not selected.\n• Interview invitations with the date, time and mode.\n• Important account, security and payment confirmations.\n\nYou can turn this off any time from Settings → Notification Channels. Account security and payment emails are always sent, because they protect your account.\n\nHappy job hunting,\nTeam Workly India',
          button_text: 'Browse Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'email_notifications_off',
        audience: 'job_seeker',
        emailOnly: true,
        label: 'Email notifications turned OFF (job seeker)',
        description: 'Final confirmation email to a job seeker who turns the Email Notifications switch OFF.',
        variables: [V.name, V.email],
        defaults: {
          title: 'Email notifications are now OFF',
          body: 'Hi {{name}},\n\nEmail notifications for your Workly India job seeker account have been switched OFF. This is the last notification email you will receive.\n\nSetting details\nAccount email: {{email}}\nChannel: Email\nStatus: Turned OFF\nUpdated on: {{date}} at {{time}}\n\nWhat you will now miss\n• New job matches for your skills and location.\n• Application updates such as shortlisted, interview scheduled or hired.\n• Interview invitations sent by employers.\n\nMany candidates lose good opportunities simply because they see an employer update too late, so we recommend keeping email notifications on.\n\nYou can switch them back on any time from Settings → Notification Channels. Account security and payment emails will still be sent, as they are required to protect your account.\n\nRegards,\nTeam Workly India',
          button_text: 'Turn Emails Back On',
          button_url: '/settings',
        },
      },
      {
        key: 'employer_email_notifications_on',
        audience: 'employer',
        emailOnly: true,
        label: 'Email notifications turned ON (employer)',
        description: 'Sent to an employer who turns the Email Notifications switch ON in Settings.',
        variables: [V.name, V.company, V.email],
        defaults: {
          title: 'Email notifications are now ON',
          body: 'Hi {{name}},\n\nEmail notifications for your Workly India employer account are now switched ON.\n\nSetting details\nCompany: {{company}}\nAccount email: {{email}}\nChannel: Email\nStatus: Turned ON\nUpdated on: {{date}} at {{time}}\n\nWhat you will receive on this email\n• An alert every time a candidate applies to one of your jobs, with their contact details.\n• Job post updates — published, expiring soon and expired.\n• Boost and company verification reminders before they end.\n• Payment confirmations for every purchase.\n\nResponding to applications quickly makes a real difference; employers who reply within 48 hours fill their openings noticeably faster.\n\nYou can turn this off any time from Settings → Notification Channels. Account security and payment emails are always sent.\n\nHappy hiring,\nTeam Workly India',
          button_text: 'Open Employer Portal',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'employer_email_notifications_off',
        audience: 'employer',
        emailOnly: true,
        label: 'Email notifications turned OFF (employer)',
        description: 'Final confirmation email to an employer who turns the Email Notifications switch OFF.',
        variables: [V.name, V.company, V.email],
        defaults: {
          title: 'Email notifications are now OFF',
          body: 'Hi {{name}},\n\nEmail notifications for your Workly India employer account have been switched OFF. This is the last notification email you will receive.\n\nSetting details\nCompany: {{company}}\nAccount email: {{email}}\nChannel: Email\nStatus: Turned OFF\nUpdated on: {{date}} at {{time}}\n\nWhat you will now miss\n• New application alerts for your job posts.\n• Job post expiry reminders, so a post can quietly go offline.\n• Boost and verification expiry reminders.\n\nYou will need to check the Employer Portal regularly so no candidate is left waiting for a reply.\n\nYou can switch notifications back on any time from Settings → Notification Channels. Payment and account security emails will still be sent.\n\nRegards,\nTeam Workly India',
          button_text: 'Turn Emails Back On',
          button_url: '/employer-settings',
        },
      },
    ],
  },
  {
    id: 'account',
    label: 'Account & profile',
    events: [
      {
        key: 'jobseeker_2fa_otp',
        audience: 'job_seeker',
        label: 'Two-Factor Authentication (job seeker)',
        description: 'Sent when a job seeker with Two-Factor Authentication (Email OTP) signs in.',
        variables: [V.name, V.otp, V.expiry_minutes],
        defaults: {
          title: 'Your Workly India login code is {{otp}}',
          body: 'Hi {{name}},\n\nUse this code to finish signing in to your Workly India account: {{otp}}\nValid for {{expiry_minutes}} minutes.\n\nNever share this code. If you did not try to sign in, please change your password.',
          button_text: '',
          button_url: '/',
        },
      },
      {
        key: 'employer_2fa_otp',
        audience: 'employer',
        label: 'Two-Factor Authentication (employer)',
        description: 'Sent when a employer with Two-Factor Authentication (Email OTP) signs in.',
        variables: [V.name, V.otp, V.expiry_minutes],
        defaults: {
          title: 'Your Workly India login code is {{otp}}',
          body: 'Hi {{name}},\n\nUse this code to finish signing in to your Workly India account: {{otp}}\nValid for {{expiry_minutes}} minutes.\n\nNever share this code. If you did not try to sign in, please change your password.',
          button_text: '',
          button_url: '/',
        },
      },
      {
        key: 'jobseeker_signup_otp',
        audience: 'job_seeker',
        emailOnly: true,
        label: 'Signup OTP (job seeker)',
        description: 'Sent when a new job seeker verifies their email before creating an account.',
        variables: [V.name, V.otp, V.expiry_minutes],
        defaults: {
          title: 'Your Workly India signup code is {{otp}}',
          body: 'Hi {{name}},\n\nUse this code to verify your email and create your Workly India account: {{otp}}\nValid for {{expiry_minutes}} minutes.\n\nIf you did not try to create an account, you can ignore this email.',
          button_text: '',
          button_url: '/',
        },
      },
      {
        key: 'employer_signup_otp',
        audience: 'employer',
        emailOnly: true,
        label: 'Signup OTP (employer)',
        description: 'Sent when a new employer verifies their email before creating an account.',
        variables: [V.name, V.otp, V.expiry_minutes],
        defaults: {
          title: 'Your Workly India employer signup code is {{otp}}',
          body: 'Hi {{name}},\n\nUse this code to verify your email and create your Workly India employer account: {{otp}}\nValid for {{expiry_minutes}} minutes.\n\nIf you did not try to create an account, you can ignore this email.',
          button_text: '',
          button_url: '/',
        },
      },
      {
        key: 'signup_welcome',
        audience: 'job_seeker',
        label: 'Welcome (new job seeker)',
        description: 'Sent after a new job seeker account is created.',
        variables: [V.name, V.mobile, V.email, V.location],
        defaults: {
          title: 'Welcome to Workly India 🎉',
          body: 'Hi {{name}},\n\nWelcome to Workly India. Your job seeker account is ready. Complete your profile so employers can discover your skills, then explore relevant opportunities and apply with confidence.\n\nAccount created on {{date}} at {{time}}.\n\nWe are glad to have you with us.',
          button_text: 'Complete Profile',
          button_url: '/profile',
        },
      },
      {
        key: 'employer_signup_welcome',
        audience: 'employer',
        label: 'Welcome (new employer)',
        description: 'Sent after a new employer account is created.',
        variables: [V.name, V.mobile, V.email, V.company],
        defaults: {
          title: 'Welcome to Workly India 🎉',
          body: 'Hi {{name}},\n\nWelcome to Workly India for Employers. Your employer account is ready. Complete your company profile and publish your first job to start connecting with qualified candidates.\n\nAccount created on {{date}} at {{time}}.\n\nWe look forward to supporting your hiring journey.',
          button_text: 'Post a Job',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'job_seeker_account_deleted',
        audience: 'job_seeker',
        emailOnly: true,
        label: 'Account deleted (job seeker)',
        description: 'Sent after a job seeker account is permanently deleted.',
        variables: [V.name, V.email],
        defaults: {
          title: 'Your Workly India account has been deleted',
          body: 'Hi {{name}},\n\nYour Workly India job seeker account has been permanently deleted, and access to the account is no longer available.\n\nDeletion completed on {{date}} at {{time}}.\n\nIf you did not expect this action or need assistance, please contact the Workly India support team.',
          button_text: 'Contact Support',
          button_url: '/contact',
        },
      },
      {
        key: 'employer_account_deleted',
        audience: 'employer',
        emailOnly: true,
        label: 'Account deleted (employer)',
        description: 'Sent after an employer account is permanently deleted.',
        variables: [V.name, V.company, V.email],
        defaults: {
          title: 'Your Workly India employer account has been deleted',
          body: 'Hi {{name}},\n\nYour Workly India employer account and its access have been permanently deleted. Your company can no longer use this account to manage jobs or applications.\n\nDeletion completed on {{date}} at {{time}}.\n\nIf you did not expect this action or need assistance, please contact the Workly India support team.',
          button_text: 'Contact Support',
          button_url: '/contact',
        },
      },
      {
        key: 'account_banned_job_seeker',
        audience: 'job_seeker',
        label: 'Account banned (job seeker)',
        description: 'Sent to a job seeker when an admin bans / suspends the account from Auth Users or Website Users.',
        variables: [V.name, V.email, V.reason],
        defaults: {
          title: '🚫 Your account has been suspended',
          body: 'Hi {{name}},\n\nYour Workly India job seeker account ({{email}}) has been suspended by our team.\n\nReason: {{reason}}\nSuspended on: {{date}} at {{time}}\n\nWhile the account is suspended you cannot sign in, apply to jobs or receive interview invitations.\n\nIf you believe this is a mistake, please contact our support team and we will review your account.\n\nRegards,\nTeam Workly India',
          button_text: 'Contact Support',
          button_url: '/contact',
        },
      },
      {
        key: 'account_unbanned_job_seeker',
        audience: 'job_seeker',
        label: 'Account restored (job seeker)',
        description: 'Sent to a job seeker when an admin removes the ban and restores the account.',
        variables: [V.name, V.email, V.reason],
        defaults: {
          title: '✅ Your account is active again',
          body: 'Hi {{name}},\n\nGood news — the suspension on your Workly India job seeker account ({{email}}) has been removed.\n\nRestored on: {{date}} at {{time}}\n\nYou can sign in again, apply to jobs and receive interview updates as usual. Please follow our community guidelines so your account stays in good standing.\n\nRegards,\nTeam Workly India',
          button_text: 'Browse Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'account_banned_employer',
        audience: 'employer',
        label: 'Account banned (employer)',
        description: 'Sent to an employer when an admin bans / suspends the company profile.',
        variables: [V.name, V.company, V.email, V.reason],
        defaults: {
          title: '🚫 Your employer account has been suspended',
          body: 'Hi {{name}},\n\nThe Workly India employer account for {{company}} ({{email}}) has been suspended by our team.\n\nReason: {{reason}}\nSuspended on: {{date}} at {{time}}\n\nWhile the account is suspended you cannot sign in, post jobs or view applications.\n\nIf you believe this is a mistake, please contact our support team and we will review your company account.\n\nRegards,\nTeam Workly India',
          button_text: 'Contact Support',
          button_url: '/contact',
        },
      },
      {
        key: 'account_unbanned_employer',
        audience: 'employer',
        label: 'Account restored (employer)',
        description: 'Sent to an employer when an admin removes the ban and restores the company account.',
        variables: [V.name, V.company, V.email, V.reason],
        defaults: {
          title: '✅ Your employer account is active again',
          body: 'Hi {{name}},\n\nThe suspension on the Workly India employer account for {{company}} ({{email}}) has been removed.\n\nRestored on: {{date}} at {{time}}\n\nYou can sign in again, post jobs and manage applications as usual. Please follow our employer guidelines so your account stays in good standing.\n\nRegards,\nTeam Workly India',
          button_text: 'Go to Dashboard',
          button_url: '/employer/dashboard',
        },
      },
      {
        key: 'job_apply_banned',
        audience: 'job_seeker',
        label: 'Job applying blocked (job seeker)',
        description: 'Sent when an admin blocks a job seeker from applying to jobs (job ban), while the account stays active.',
        variables: [V.name, V.email, V.reason],
        defaults: {
          title: '⚠️ Job applications paused on your account',
          body: 'Hi {{name}},\n\nYour Workly India account ({{email}}) can no longer apply to jobs. Our team has placed a job application restriction on the account.\n\nReason: {{reason}}\nApplied on: {{date}} at {{time}}\n\nYou can still sign in and view your profile, but new applications are blocked until the restriction is removed.\n\nIf you think this is a mistake, please contact our support team.\n\nRegards,\nTeam Workly India',
          button_text: 'Contact Support',
          button_url: '/contact',
        },
      },
      {
        key: 'job_apply_unbanned',
        audience: 'job_seeker',
        label: 'Job applying restored (job seeker)',
        description: 'Sent when an admin removes the job application restriction from a job seeker account.',
        variables: [V.name, V.email, V.reason],
        defaults: {
          title: '✅ You can apply to jobs again',
          body: 'Hi {{name}},\n\nThe job application restriction on your Workly India account ({{email}}) has been removed.\n\nRestored on: {{date}} at {{time}}\n\nYou can start applying to jobs right away. Keep your profile updated so employers notice you faster.\n\nRegards,\nTeam Workly India',
          button_text: 'Apply Now',
          button_url: '/jobs',
        },
      },
      {
        key: 'job_posting_banned',
        audience: 'employer',
        label: 'Job posting blocked (employer)',
        description: 'Sent when an admin blocks a company from posting new jobs, while the account stays active.',
        variables: [V.name, V.company, V.email, V.reason],
        defaults: {
          title: '⚠️ Job posting paused for your company',
          body: 'Hi {{name}},\n\nNew job posting has been paused for {{company}} on Workly India.\n\nReason: {{reason}}\nApplied on: {{date}} at {{time}}\n\nYour account still works and your existing jobs stay visible, but you cannot publish new jobs until this restriction is removed.\n\nIf you think this is a mistake, please contact our support team.\n\nRegards,\nTeam Workly India',
          button_text: 'Contact Support',
          button_url: '/contact',
        },
      },
      {
        key: 'job_posting_unbanned',
        audience: 'employer',
        label: 'Job posting restored (employer)',
        description: 'Sent when an admin allows a company to post jobs again.',
        variables: [V.name, V.company, V.email, V.reason],
        defaults: {
          title: '✅ You can post jobs again',
          body: 'Hi {{name}},\n\nJob posting has been enabled again for {{company}} on Workly India.\n\nRestored on: {{date}} at {{time}}\n\nYou can publish new openings right away and start receiving applications from candidates.\n\nRegards,\nTeam Workly India',
          button_text: 'Post a Job',
          button_url: '/employer/post-job',
        },
      },
      {
        key: 'profile_complete',
        audience: 'job_seeker',
        label: 'Profile completed',
        description: 'Sent when a profile reaches 100% completion.',
        variables: [V.name, V.mobile, V.email, V.location],
        defaults: {
          title: 'Profile complete ✅',
          body: 'Well done {{name}}! You can now apply to jobs with one tap.',
          button_text: 'Browse Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'profile_incomplete_job_seeker',
        audience: 'job_seeker',
        label: 'Profile incomplete reminder',
        description: 'Monthly reminder sent when a job seeker profile is still incomplete.',
        variables: [V.name, V.mobile, V.email, V.location],
        defaults: {
          title: '📋 Complete Your Profile',
          body: 'Hi {{name}}, complete your profile for 3x more visibility to employers!',
          button_text: 'Complete Profile',
          button_url: '/profile',
        },
      },
      {
        key: 'profile_incomplete_employer',
        audience: 'employer',
        label: 'Company profile incomplete reminder',
        description: 'Monthly reminder sent when a company profile is still incomplete.',
        variables: [V.name, V.company, V.email],
        defaults: {
          title: '🏢 Complete Company Profile',
          body: 'Hi {{name}}, complete your company profile to attract better candidates!',
          button_text: 'Complete Profile',
          button_url: '/employer-portal',
        },
      },
    ],
  },
  {
    // Delivered through Supabase's Auth "Send email" hook: Supabase no longer
    // mails these itself, it hands the token and link to auth-email-hook, which
    // renders the copy saved here and sends it from the owner's mailbox.
    id: 'auth',
    label: 'Email verification & security',
    events: [
      {
        key: 'email_verification',
        emailOnly: true,
        label: 'Confirm email address (signup)',
        description: 'Sends a one-time code when someone signs up and must confirm their email.',
        variables: [V.name, V.email, V.otp],
        defaults: {
          title: '{{otp}} is your Workly India verification code',
          body: 'Your verification code is {{otp}}. Enter it on the verification screen. It expires shortly and can be used only once.',
          button_text: '',
          button_url: '',
        },
      },
      {
        key: 'password_reset',
        emailOnly: true,
        label: 'Password reset code',
        description: 'Sends a one-time code when someone asks to reset their password.',
        variables: [V.name, V.email, V.otp],
        defaults: {
          title: '{{otp}} is your Workly India password reset code',
          body: 'Your password reset code is {{otp}}. Enter it on the reset screen. It expires shortly and can be used only once.',
          button_text: '',
          button_url: '',
        },
      },
      {
        key: 'magic_link',
        emailOnly: true,
        label: 'Magic sign-in code',
        description: 'Sends a one-time code for passwordless email sign-in.',
        variables: [V.name, V.email, V.otp],
        defaults: {
          title: '{{otp}} is your Workly India sign-in code',
          body: 'Your sign-in code is {{otp}}. Enter it on the sign-in screen. It expires shortly and can be used only once.',
          button_text: '',
          button_url: '',
        },
      },
      {
        key: 'email_change_new',
        emailOnly: true,
        label: 'Confirm new email address',
        description: 'Sent to the new address when someone changes the email on their account.',
        variables: [V.name, V.email, V.otp, V.old_email],
        defaults: {
          title: '{{otp}} confirms your new Workly India email',
          body: 'Enter {{otp}} on the email-change screen to verify your new address. It expires shortly and can be used only once.',
          button_text: '',
          button_url: '',
        },
      },
      {
        key: 'email_change_current',
        emailOnly: true,
        label: 'Email change alert (current address)',
        description: 'Sent to the address on file today when an email change is requested.',
        variables: [V.name, V.email, V.new_email, V.otp],
        defaults: {
          title: '{{otp}} confirms your Workly India email change',
          body: 'Enter {{otp}} on the email-change screen to approve moving your account to {{new_email}}. If this was not you, do not share the code.',
          button_text: '',
          button_url: '',
        },
      },
    ],
  },
  {
    id: 'applications',
    label: 'Job applications (job seeker)',
    events: [
      {
        key: 'application_submitted',
        audience: 'job_seeker',
        label: 'Application submitted',
        description: 'Sent when a job application is submitted.',
        variables: [V.name, V.job_title, V.company, V.location],
        defaults: {
          title: 'Application sent ✅',
          body: 'Your application for {{job_title}} at {{company}} was submitted successfully.\nDate: {{date}}\nTime: {{time}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'application_status_changed',
        audience: 'job_seeker',
        label: 'Application status changed (generic)',
        description: 'Fallback sent when the application status changes to a stage without its own template.',
        variables: [V.name, V.job_title, V.company, V.status],
        defaults: {
          title: 'Application status updated',
          body: '{{job_title}} at {{company}}\nNew status : {{status}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'application_under_review',
        audience: 'job_seeker',
        label: 'Application under review',
        description: 'Sent when the employer marks the application as under review.',
        variables: [V.name, V.job_title, V.company, V.status],
        defaults: {
          title: '👀 Application under review',
          body: '{{company}} is reviewing your application for {{job_title}}.\nDate: {{date}}\nTime: {{time}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'application_shortlisted',
        audience: 'job_seeker',
        label: 'Application shortlisted',
        description: 'Sent when the employer shortlists the candidate.',
        variables: [V.name, V.job_title, V.company, V.status],
        defaults: {
          title: '🎉 You have been shortlisted',
          body: 'Great news! {{company}} shortlisted you for {{job_title}}.\nKeep your phone reachable.\nDate: {{date}}\nTime: {{time}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'application_interview_scheduled',
        audience: 'job_seeker',
        label: 'Application moved to interview',
        description: 'Sent when the application status is set to interview scheduled.',
        variables: [V.name, V.job_title, V.company, V.interview_date, V.interview_time, V.mode],
        defaults: {
          title: '📅 Interview scheduled',
          body: '{{company}} scheduled an interview for {{job_title}}.\nDate: {{interview_date}}\nTime: {{interview_time}}\nMode: {{mode}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'application_hired',
        audience: 'job_seeker',
        label: 'Application hired / selected',
        description: 'Sent when the employer selects the candidate for the job.',
        variables: [V.name, V.job_title, V.company],
        defaults: {
          title: '🎊 Congratulations, you are hired',
          body: '{{company}} has selected you for {{job_title}}.\nDate: {{date}}\nTime: {{time}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'application_rejected',
        audience: 'job_seeker',
        label: 'Application not selected',
        description: 'Sent when the employer does not move ahead with the application.',
        variables: [V.name, V.job_title, V.company],
        defaults: {
          title: '📋 Application update',
          body: '{{company}} did not move ahead with your application for {{job_title}}.\nKeep applying — better jobs are waiting.\nDate: {{date}}\nTime: {{time}}',
          button_text: 'Browse Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'application_withdrawn',
        audience: 'job_seeker',
        label: 'Application withdrawn',
        description: 'Sent when an application is withdrawn.',
        variables: [V.name, V.job_title, V.company],
        defaults: {
          title: '↩️ Application withdrawn',
          body: 'Your application for {{job_title}} at {{company}} has been withdrawn.\nDate: {{date}}\nTime: {{time}}',
          button_text: 'Browse Jobs',
          button_url: '/jobs',
        },
      },

      {
        key: 'application_viewed',
        audience: 'job_seeker',
        label: 'Application viewed by employer',
        description: 'Sent when an employer opens and reviews the candidate application.',
        variables: [V.job_title, V.company],
        defaults: {
          title: 'Your application was viewed 👀',
          body: '{{company}} just reviewed your application for {{job_title}}.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'interview_status_update',
        audience: 'job_seeker',
        label: 'Interview scheduled (job seeker)',
        description: 'Sent to the job seeker when an interview is scheduled, live, rescheduled, completed or cancelled.',
        variables: [V.name, V.job_title, V.company, V.status, V.interview_date, V.interview_time, V.mode],
        defaults: {
          title: 'Interview update 📅',
          body: '{{job_title}} at {{company}}\nStatus: {{status}}\nInterview date: {{interview_date}}\nInterview time: {{interview_time}}\nMode: {{mode}}',
          button_text: 'View Activity',
          button_url: '/activity',
        },
      },
      {
        key: 'interview_employer_joined',
        audience: 'job_seeker',
        label: 'Interviewer joined the interview',
        description: 'Sent to the job seeker when the employer joins / opens the interview room.',
        variables: [V.name, V.job_title, V.company, V.interview_date, V.interview_time, V.mode],
        defaults: {
          title: '🎥 Interviewer has joined',
          body: '{{company}} has joined your interview for {{job_title}}.\nPlease join now.\nMode: {{mode}}\nDate: {{date}}\nTime: {{time}}',
          button_text: 'Join Interview',
          button_url: '/activity',
        },
      },
      {
        key: 'interview_started',
        audience: 'job_seeker',
        label: 'Interview started',
        description: 'Sent to the job seeker when the interview start time arrives.',
        variables: [V.name, V.job_title, V.company, V.interview_date, V.interview_time, V.mode],
        defaults: {
          title: '🔴 Your interview has started',
          body: '{{job_title}} at {{company}}\nYour interview time has started — join now.\nDate: {{interview_date}}\nTime: {{interview_time}}\nMode: {{mode}}',
          button_text: 'Join Now',
          button_url: '/activity',
        },
      },
      {
        key: 'new_job_match',
        audience: 'job_seeker',
        label: 'New job match',
        description: 'Sent when a newly posted job matches the job seeker profile.',
        variables: [V.name, V.job_title, V.company, V.location],
        defaults: {
          title: 'New job match 🔥',
          body: '{{job_title}} at {{company}}\nLocation : {{location}}\nPosted : {{date}} {{time}}',
          button_text: 'View Job',
          button_url: '/jobs',
        },
      },
    ],
  },
  {
    id: 'employer',
    label: 'Employer alerts',
    events: [
      {
        key: 'new_application_received',
        audience: 'employer',
        label: 'New application received',
        description: 'Sent when a candidate applies to your job.',
        variables: [V.name, V.mobile, V.whatsapp, V.email, V.location, V.job_title, V.company],
        defaults: {
          title: 'New application received',
          body: 'Job : {{job_title}}\nName : {{name}}\nMobile : {{mobile}}\nWhatsApp : <a href="https://wa.me/{{whatsapp_digits}}">{{whatsapp}}</a>\nEmail : {{email}}\nLocation : {{location}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Applicants',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'job_posted',
        audience: 'employer',
        label: 'Job posted / live',
        description: 'Sent when a job post goes live.',
        variables: [V.job_title, V.company, V.location, V.expiry_date],
        defaults: {
          title: 'Your job is live 🚀',
          body: '{{job_title}} is now visible to candidates.\nLocation : {{location}}\nPosted : {{date}} {{time}}',
          button_text: 'View Job',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'employer_interview_scheduled',
        audience: 'employer',
        label: 'Interview update (employer)',
        description: 'Sent to the employer when an interview is scheduled, rescheduled, completed or cancelled.',
        variables: [V.name, V.job_title, V.company, V.status, V.interview_date, V.interview_time, V.mode],
        defaults: {
          title: 'Interview update 📅',
          body: 'Candidate : {{name}}\nJob : {{job_title}}\nStatus : {{status}}\nInterview date : {{interview_date}}\nInterview time : {{interview_time}}\nMode : {{mode}}',
          button_text: 'View Interviews',
          button_url: '/employer-portal',
        },
      },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    events: [
      {
        key: 'payment_success',
        audience: 'employer',
        label: 'Payment Success',
        description: 'Sent after a Razorpay payment is completed successfully.',
        variables: [V.name, V.amount, V.order_id],
        defaults: {
          title: 'Payment successful ✅',
          body: 'Amount : {{amount}}\nOrder ID : {{order_id}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Payment History',
          button_url: '/payment-history',
        },
      },
      {
        key: 'payment_failed',
        audience: 'employer',
        label: 'Payment Failed',
        description: 'Sent when a Razorpay payment fails or is cancelled.',
        variables: [V.name, V.amount, V.order_id],
        defaults: {
          title: 'Payment failed',
          body: 'Amount : {{amount}}\nOrder ID : {{order_id}}\nDate : {{date}}\nTime : {{time}}\nPlease try again.',
          button_text: 'Try Again',
          button_url: '/payment-history',
        },
      },
      {
        key: 'payment_refund',
        audience: 'employer',
        emailOnly: true,
        label: 'Payment Refund',
        description: 'Sent when a Razorpay refund is processed or fails. Includes Payment PDF and Invoice.',
        variables: [V.name, V.amount, V.order_id],
        defaults: {
          title: '{{plan}}',
          body: '',
          button_text: 'Download PDF',
          button_url: '/payment-history',
        },
      },
      {
        key: 'paypal_payment_success',
        audience: 'employer',
        emailOnly: true,
        label: 'PayPal Payment Success',
        description: 'Sent after PayPal confirms a payment (verified webhook).',
        variables: [V.name, V.amount, V.order_id],
        defaults: {
          title: 'Payment Successful — {{plan}}',
          body: 'Hi {{name}}, your PayPal payment of {{amount}} has been received successfully.',
          button_text: 'View Payment History',
          button_url: '/payment-history',
        },
      },
      {
        key: 'paypal_payment_failed',
        audience: 'employer',
        emailOnly: true,
        label: 'PayPal Payment Failed',
        description: 'Sent when PayPal declines or denies a payment (verified webhook).',
        variables: [V.name, V.amount, V.order_id],
        defaults: {
          title: 'Payment Failed — {{plan}}',
          body: 'Hi {{name}}, your PayPal payment of {{amount}} could not be completed. No money was taken. Please try again.',
          button_text: 'Try Again',
          button_url: '/payment-history',
        },
      },
      {
        key: 'paypal_payment_refund',
        audience: 'employer',
        emailOnly: true,
        label: 'PayPal Payment Refund',
        description: 'Sent when a PayPal refund is processed, pending or fails (verified webhook).',
        variables: [V.name, V.amount, V.order_id],
        defaults: {
          title: 'Payment Refund — {{plan}}',
          body: 'Hi {{name}}, a refund of {{refund_amount}} has been issued for your PayPal payment of {{amount}}.',
          button_text: 'View Payment History',
          button_url: '/payment-history',
        },
      },
      {
        key: 'refund_initiated',
        noEmail: true,
        label: 'Refund started',
        description: 'Sent when a refund is started for a Razorpay payment.',
        variables: [V.name, V.amount, V.order_id],
        defaults: {
          title: 'Refund started 🔄',
          body: 'Amount : {{amount}}\nOrder ID : {{order_id}}\nDate : {{date}}\nIt will reach your account in 5-7 working days.',
          button_text: 'View Payment History',
          button_url: '/payment-history',
        },
      },
      {
        key: 'subscription_expiring',
        audience: 'employer',
        noEmail: true,
        label: 'Plan expiring soon',
        description: 'Sent before a paid plan ends.',
        variables: [V.name, V.plan, V.expiry_date],
        defaults: {
          title: 'Your plan is ending soon 📆',
          body: 'Plan : {{plan}}\nEnds on : {{expiry_date}}\nRenew now to keep your benefits.',
          button_text: 'Renew Plan',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'wallet_credit',
        audience: 'employer',
        noEmail: true,
        label: 'Payment received',
        description: 'Sent when a payment is completed on the platform via Razorpay.',
        variables: [V.name, V.amount],
        defaults: {
          title: 'Payment received 💰',
          body: 'Amount paid : {{amount}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Payment History',
          button_url: '/payment-history',
        },
      },
      {
        key: 'wallet_points_debited',
        audience: 'employer',
        noEmail: true,
        label: 'Service purchase confirmed',
        description: 'Sent when a Razorpay payment is completed for any service.',
        variables: [V.name, V.amount, { key: 'item', label: 'Service', sample: 'Job Boost - 7 days' }],
        defaults: {
          title: 'Service purchase confirmed 🔻',
          body: 'Amount paid : {{amount}}\nFor : {{item}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Payment History',
          button_url: '/payment-history',
        },
      },
      {
        key: 'google_bing_publish_activated',
        audience: 'employer',
        noEmail: true,
        label: 'Published on Google & Bing',
        description: 'Sent when a job is paid for Publish on Google & Bing via Razorpay.',
        variables: [V.name, V.job_title, V.amount, { key: 'item', label: 'Service', sample: 'Publish on Google & Bing' }],
        defaults: {
          title: 'Job sent to Google & Bing 🌐',
          body: 'Job : {{job_title}}\nPaid : {{amount}}\nDate : {{date}}\nTime : {{time}}\nYour job will appear in Google & Bing search soon.',
          button_text: 'View Job',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'job_boost_activated',
        audience: 'employer',
        noEmail: true,
        label: 'Job boost active',
        description: 'Sent when a job boost becomes active.',
        variables: [V.name, V.job_title, V.amount, { key: 'item', label: 'Boost package', sample: 'Boost 7 days' }],
        defaults: {
          title: 'Job boost is now active 🚀',
          body: 'Job : {{job_title}}\nPackage : {{item}}\nDate : {{date}}\nTime : {{time}}\nYour job now shows at the top of search results.',
          button_text: 'View Job',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'verification_badge_activated',
        audience: 'employer',
        noEmail: true,
        label: 'Verified badge active',
        description: 'Sent when the company verified badge becomes active.',
        variables: [V.name, V.company, V.amount, { key: 'item', label: 'Badge package', sample: 'Blue Badge' }],
        defaults: {
          title: 'Verified badge is now active ✅',
          body: 'Company : {{company}}\nBadge : {{item}}\nDate : {{date}}\nTime : {{time}}\nCandidates now see your company as verified.',
          button_text: 'View Company',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'ai_plan_activated',
        audience: 'employer',
        noEmail: true,
        label: 'AI plan active',
        description: 'Sent when an AI plan is purchased and becomes active.',
        variables: [V.name, V.plan, V.amount, V.expiry_date],
        defaults: {
          title: 'Your AI plan is active 🤖',
          body: 'Plan : {{plan}}\nAmount : {{amount}}\nValid till : {{expiry_date}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Open AI Chat',
          button_url: '/ai-chat',
        },
      },
    ],
  },
  {
    id: 'referral',
    label: 'Referral program',
    events: [
      {
        key: 'referral_join',
        label: 'New referral joined',
        description: 'Sent when someone joins using your referral code.',
        variables: [V.referral_name, V.location, V.balance],
        defaults: {
          title: 'New referral joined 🎉',
          body: 'Name : {{referral_name}}\nJoined on : {{date}} {{time}}',
          button_text: 'View Referrals',
          button_url: '/referral',
        },
      },
      {
        key: 'referral_milestone',
        label: 'Referral milestone achieved',
        description: 'Sent when a referral milestone of 5, 10 or 25 joins is reached.',
        variables: [V.name, V.rank, V.amount, V.balance],
        defaults: {
          title: 'Referral milestone unlocked 🎯',
          body: 'Milestone : {{rank}}\nReward : {{amount}}\nWallet balance : {{balance}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Referrals',
          button_url: '/referral',
        },
      },
      {
        key: 'commission_earned',
        label: 'Referral earning credited',
        description: 'Sent when a referral earning is credited to the wallet.',
        variables: [V.referral_name, V.amount, V.balance],
        defaults: {
          title: 'Referral earning credited 💸',
          body: 'Amount : {{amount}}\nWallet balance : {{balance}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Referrals',
          button_url: '/referral',
        },
      },
      {
        key: 'referral_withdrawal',
        label: 'Withdrawal status',
        description: 'Sent when a withdrawal is requested, approved, paid or rejected.',
        variables: [V.amount, V.status, V.balance],
        defaults: {
          title: 'Withdrawal update',
          body: 'Amount : {{amount}}\nStatus : {{status}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Referrals',
          button_url: '/referral',
        },
      },
      {
        key: 'referral_competition_win',
        label: 'Competition prize won',
        description: 'Sent when a user wins a prize in the monthly referral competition.',
        variables: [V.rank, V.prize, V.amount],
        defaults: {
          title: 'You won a prize 🏆',
          body: 'Rank : {{rank}}\nPrize : {{prize}}\nDate : {{date}}\nTime : {{time}}',
          button_text: 'View Referrals',
          button_url: '/referral',
        },
      },
    ],
  },
  {
    id: 'expiry',
    label: 'Expiry reminders',
    events: [
      {
        key: 'weekly_digest',
        audience: 'job_seeker',
        label: '10 Matching Jobs Alert',
        description: 'Naukri-style personalized list of up to 10 matching jobs. Sent only to job seekers active in the last 30 days.',
        variables: [V.name, V.job_count, V.jobs_list],
        defaults: {
          title: '🎯 {{job_count}} New Jobs Matched For You',
          body: 'Hi <b>{{name}}</b> 👋\n\n<b>Explore these jobs by top companies</b>\n<i>Picked for your skills, preferred role and location</i>\n\n━━━━━━━━━━━━\n\n{{jobs_list}}\n\n━━━━━━━━━━━━\n\n😕 <b>Not getting relevant jobs?</b>\nUpdate your profile to get better matches.',
          button_text: 'View all recommendations',
          button_url: '/jobs',
        },
      },
      {
        key: 'resume_builder_promo',
        audience: 'job_seeker',
        label: 'Create Resume (Templates)',
        description: 'All resume templates with a Create Resume button under each. Sent once every 7 days to job seekers active in the last 30 days.',
        variables: [V.name, V.resume_templates],
        defaults: {
          title: '📄 Build a job-winning resume in minutes',
          body: 'Hi <b>{{name}}</b> 👋\n\n<b>Choose a free resume template</b>\n<i>ATS friendly designs that recruiters love</i>\n\n{{resume_templates}}',
          button_text: 'Create Resume',
          button_url: '/resume-builder/create/1',
        },
      },
      {
        key: 'cover_letter_builder_promo',
        audience: 'job_seeker',
        label: 'Create Cover Letter (Templates)',
        description: 'All cover letter templates with a Create Cover Letter button under each. Sent once every 7 days to job seekers active in the last 30 days.',
        variables: [V.name, V.cover_templates],
        defaults: {
          title: '✉️ Write a standout cover letter',
          body: 'Hi <b>{{name}}</b> 👋\n\n<b>Choose a free cover letter template</b>\n<i>Get noticed by employers faster</i>\n\n{{cover_templates}}',
          button_text: 'Create Cover Letter',
          button_url: '/cover-letter-builder/create/1',
        },
      },
      {
        key: 'developer_platform_promo',
        audience: 'employer',
        label: 'Developer Platform (Services)',
        description: 'All Workly India developer services with a docs button under each. Sent once every 7 days to employers active in the last 30 days. Never sent to job seekers.',
        variables: [V.name, V.developer_services],
        defaults: {
          title: '🚀 Build faster with Workly India APIs',
          body: 'Hi <b>{{name}}</b> 👋\n\n<b>Everything your team needs to add jobs, messaging and sign-in to your website</b>\n<i>Show live Workly India jobs with Email, WhatsApp, OAuth and Chat Widget APIs in one place</i>\n\n{{developer_services}}',
          button_text: 'Open Developer Portal',
          button_url: '/developers',
        },
      },
      {
        key: 'job_expiry',
        audience: 'employer',
        label: 'Job post expiry',
        description: 'Sent 24 hours before expiry and again when it expires.',
        variables: [V.job_title, V.company, V.expiry_date],
        defaults: {
          title: 'Job post expiring soon ⏰',
          body: 'Job : {{job_title}}\nExpires on : {{expiry_date}}\nExtend it to stay visible.',
          button_text: 'Extend Job',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'boost_expiry',
        audience: 'employer',
        label: 'Job boost expiry',
        description: 'Sent 24 hours before a boost ends and again after it ends.',
        variables: [V.job_title, V.expiry_date],
        defaults: {
          title: 'Job boost ending ⏰',
          body: 'Job : {{job_title}}\nBoost ends on : {{expiry_date}}\nRenew it to keep the top spot.',
          button_text: 'Renew Boost',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'verification_expiry',
        audience: 'employer',
        label: 'Verified badge expiry',
        description: 'Sent 24 hours before a badge expires and again after expiry.',
        variables: [V.company, V.expiry_date],
        defaults: {
          title: 'Verified badge expiring ⏰',
          body: 'Company : {{company}}\nExpires on : {{expiry_date}}\nRenew it to stay verified.',
          button_text: 'Renew Badge',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'domain_expiry',
        audience: 'employer',
        label: 'Domain expiry',
        description: 'Sent 24 hours before a domain expires and again after expiry.',
        variables: [V.domain, V.expiry_date, V.amount],
        defaults: {
          title: 'Domain expiring ⏰',
          body: 'Domain : {{domain}}\nExpires on : {{expiry_date}}\nRenew it to keep it active.',
          button_text: 'Renew Domain',
          button_url: '/domains',
        },
      },
      {
        key: 'ai_plan_expiry',
        audience: 'both',
        label: 'AI chat plan expiry',
        description: 'Sent 24 hours before a plan expires and again after expiry.',
        variables: [V.plan, V.expiry_date, V.amount],
        defaults: {
          title: 'AI plan expiring ⏰',
          body: 'Plan : {{plan}}\nExpires on : {{expiry_date}}\nRenew it to avoid interruption.',
          button_text: 'Renew Plan',
          button_url: '/ai-assistant/subscription',
        },
      },
    ],
  },
  {
    id: 'bot_start',
    label: 'Bot /start (connect help)',
    events: [
      {
        key: 'bot_start_job_seeker',
        label: 'Job seeker bot /start message',
        description: 'Sent when a job seeker sends /start to the bot (how to connect).',
        audience: 'job_seeker',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '😊 Welcome {{name}}!',
          body: '👋 <b>Welcome to Workly India</b>\n\nSend your <b>Connect Code</b> here to link your account.\n\n💡 <b>Where to find the code:</b>\nProfile → Edit Profile → Telegram Section\n\nThe code looks like this: <code>P-ABC123</code>\n\n📱 Just paste the code and send it.',
          button_text: 'Open Profile',
          button_url: '/profile',
        },
      },
      {
        key: 'bot_start_employer',
        label: 'Employer bot /start message',
        description: 'Sent when an employer sends /start to the bot (how to connect).',
        audience: 'employer',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '😊 Welcome {{name}}!',
          body: '👋 <b>Welcome to Workly India</b>\n\nSend your <b>Connect Code</b> here to link your employer account.\n\n💡 <b>Where to find the code:</b>\nEmployer Portal → Profile → Telegram Section\n\nThe code looks like this: <code>E-XYZ789</code>\n\n📱 Just paste the code and send it.',
          button_text: 'Employer Portal',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'bot_invalid_code_job_seeker',
        label: 'Wrong code (job seeker bot)',
        description: 'Sent when a wrong or employer code is sent to the job seeker bot.',
        audience: 'job_seeker',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '❌ Invalid Connect Code',
          body: 'This code does not work on this bot.\n\nA job seeker account code starts with <code>P-</code>.\n\n💡 Find your code here: Settings → Telegram Integration\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Open Settings',
          button_url: '/settings',
        },
      },
      {
        key: 'bot_invalid_code_employer',
        label: 'Wrong code (employer bot)',
        description: 'Sent when a wrong or job seeker code is sent to the employer bot.',
        audience: 'employer',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '❌ Invalid Connect Code',
          body: 'This code does not work on this bot.\n\nAn employer account code starts with <code>E-</code>.\n\n💡 Find your code here: Employer Settings → Telegram Integration\nDate : {{date}}\nTime : {{time}}',

          button_text: 'Employer Settings',
          button_url: '/employer-settings',
        },
      },
      {
        key: 'bot_already_connected_job_seeker',
        label: 'Already connected (job seeker bot)',
        description: 'Sent when a job seeker sends a code but this Telegram is already linked.',
        audience: 'job_seeker',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '✅ Already Connected!',
          body: 'Hi {{name}}, your Telegram is already linked to your Workly India job seeker account.\n\n🔔 Job alerts and application updates will keep arriving right here.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Explore Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'bot_already_connected_employer',
        label: 'Already connected (employer bot)',
        description: 'Sent when an employer sends a code but this Telegram is already linked.',
        audience: 'employer',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '✅ Already Connected!',
          body: 'Hi {{name}}, your Telegram is already linked to your Workly India employer account.\n\n🔔 Candidate applications and hiring updates will keep arriving right here.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Employer Portal',
          button_url: '/employer-portal',
        },
      },
      {
        key: 'bot_code_used_job_seeker',
        label: 'Code already used (job seeker bot)',
        description: 'Sent when a job seeker account is already linked to a different Telegram.',
        audience: 'job_seeker',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '⚠️ Code Already Used',
          body: 'This job seeker account is already connected to a different Telegram account.\n\n💡 First disconnect Telegram from Settings → Telegram Integration, then generate a new connect code and send it here.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Open Settings',
          button_url: '/settings',
        },
      },
      {
        key: 'bot_code_used_employer',
        label: 'Code already used (employer bot)',
        description: 'Sent when an employer account is already linked to a different Telegram.',
        audience: 'employer',
        telegramOnly: true,
        variables: [V.name],
        defaults: {
          title: '⚠️ Code Already Used',
          body: 'This employer account is already connected to a different Telegram account.\n\n💡 First disconnect Telegram from Employer Settings → Telegram Integration, then generate a new connect code and send it here.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Employer Settings',
          button_url: '/employer-settings',
        },
      },
    ],


  },
  {
    id: 'telegram_channel',
    label: 'Telegram channel',
    events: [
      {
        key: 'channel_job_post',
        audience: 'employer',
        label: 'Channel job post',
        description: 'Sent to the Telegram channel when a new job is published on the website.',
        telegramOnly: true,
        variables: [
          V.job_title,
          V.company,
          V.location,
          V.job_type,
          V.salary,
          V.job_url,
          V.post_date,
          V.post_time,
        ],
        defaults: {
          title: '📌 New Job Opening',
          body: '📌 <b>{{job_title}}</b>\n🏢 {{company}}\n📍 {{location}}\n💼 {{job_type}}\n💰 {{salary}}\n\n🗓️ <b>Post Date:</b> {{post_date}}\n⏰ <b>Post Time:</b> {{post_time}}\n\n✅ <i>Verified by Workly India</i>\n🔗 <a href="{{job_url}}">View Details &amp; Apply</a>\n\n#WorklyIndia #Jobs #Hiring',
          button_text: '',
          button_url: '',
        },
      },
    ],
  },
  {
    id: 'festival',
    label: 'Festival & Holiday greetings',
    events: [
      {
        key: 'festival_greeting_job_seeker',
        audience: 'job_seeker',
        label: 'Festival / Holiday wish (job seeker)',
        description:
          'Sent automatically on the festival or holiday date. The AI writes fresh wording for push (short), Telegram (medium) and Email (full) every time — this template is the style guide and the fallback.',
        variables: [
          V.name,
          { key: 'festival', label: 'Festival / Holiday name', sample: 'Diwali' },
          { key: 'festival_date', label: 'Festival date', sample: '09/11/2026' },
        ],
        defaults: {
          title: '🎉 Happy {{festival}}, {{name}}!',
          body: 'Hi {{name}}, wishing you and your family a very happy {{festival}}! 🎊\n\nMay this {{festival}} bring you new opportunities and the job you have been waiting for.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Explore Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'festival_greeting_employer',
        audience: 'employer',
        label: 'Festival / Holiday wish (employer)',
        description:
          'Sent automatically on the festival or holiday date to employers. The AI writes fresh wording for push (short), Telegram (medium) and Email (full) every time — this template is the style guide and the fallback.',
        variables: [
          V.name,
          { key: 'festival', label: 'Festival / Holiday name', sample: 'Diwali' },
          { key: 'festival_date', label: 'Festival date', sample: '09/11/2026' },
        ],
        defaults: {
          title: '🎉 Happy {{festival}} from Workly India!',
          body: 'Dear {{name}}, warm wishes on {{festival}} from the Workly India team! 🎊\n\nMay this {{festival}} bring growth to your business and the right talent to your team.\nDate : {{date}}\nTime : {{time}}',
          button_text: 'Open Dashboard',
          button_url: '/employer/dashboard',
        },
      },
    ],
  },
  {
    id: 'birthday',
    label: 'Birthday wishes',
    events: [
      {
        key: 'birthday_greeting_job_seeker',
        audience: 'job_seeker',
        label: 'Birthday wish (job seeker)',
        description:
          'Sent automatically on the job seeker\'s date of birth (from their profile) at 9:05 AM IST, to job seekers who logged in within the last 30 days. Push, Telegram and Email all use exactly the wording saved here.',
        variables: [V.name, { key: 'age', label: 'Age turning', sample: '23' }],
        defaults: {
          title: '🎂 Happy Birthday, {{name}}!',
          body: 'Wishing you a wonderful year ahead and the right job soon.',
          button_text: 'Explore Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'birthday_greeting_employer',
        audience: 'employer',
        label: 'Birthday wish (employer)',
        description:
          'Sent automatically on the employer\'s date of birth (from their profile) at 9:05 AM IST, to employers who logged in within the last 30 days. Push, Telegram and Email all use exactly the wording saved here.',
        variables: [V.name, { key: 'age', label: 'Age turning', sample: '23' }],
        defaults: {
          title: '🎂 Happy Birthday, {{name}}!',
          body: 'Wishing you a wonderful year ahead and great hiring success for your team.',
          button_text: 'Open Dashboard',
          button_url: '/employer/dashboard',
        },
      },
    ],
  },
  {
    id: 'daily_greetings',
    label: 'Daily greetings (Good Morning / Afternoon / Evening / Night)',
    events: [
      {
        key: 'daily_morning_job_seeker',
        audience: 'job_seeker',
        label: '🌅 Good Morning 8:00 AM (job seeker)',
        description: 'Sent every day at 8:00 AM IST to job seekers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '🌅 Good Morning, {{name}}!',
          body: 'Top companies are hiring right now — apply early and get noticed before everyone else.',
          button_text: 'Apply Now',
          button_url: '/jobs',
        },
      },
      {
        key: 'daily_morning_employer',
        audience: 'employer',
        label: '🌅 Good Morning 8:00 AM (employer)',
        description: 'Sent every day at 8:00 AM IST to employers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '🌅 Good Morning, {{name}}!',
          body: 'Thousands of job seekers are active right now — post your job first and reach the best candidates today.',
          button_text: 'Post a Job',
          button_url: '/employer/dashboard',
        },
      },
      {
        key: 'daily_afternoon_job_seeker',
        audience: 'job_seeker',
        label: '☀️ Good Afternoon 1:30 PM (job seeker)',
        description: 'Sent every day at 1:30 PM IST to job seekers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '☀️ Good Afternoon, {{name}}!',
          body: 'Fresh jobs just went live — candidates who apply within hours get noticed first.',
          button_text: 'View Fresh Jobs',
          button_url: '/jobs',
        },
      },
      {
        key: 'daily_afternoon_employer',
        audience: 'employer',
        label: '☀️ Good Afternoon 1:30 PM (employer)',
        description: 'Sent every day at 1:30 PM IST to employers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '☀️ Good Afternoon, {{name}}!',
          body: 'Great candidates are applying this hour — boost your job to the top and hire faster.',
          button_text: 'Boost Your Job',
          button_url: '/employer/dashboard',
        },
      },
      {
        key: 'daily_evening_job_seeker',
        audience: 'job_seeker',
        label: '🌆 Good Evening 6:00 PM (job seeker)',
        description: 'Sent every day at 6:00 PM IST to job seekers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '🌆 Good Evening, {{name}}!',
          body: "Don't end today without an application — your next job could be one click away.",
          button_text: 'Apply in 1 Minute',
          button_url: '/jobs',
        },
      },
      {
        key: 'daily_evening_employer',
        audience: 'employer',
        label: '🌆 Good Evening 6:00 PM (employer)',
        description: 'Sent every day at 6:00 PM IST to employers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '🌆 Good Evening, {{name}}!',
          body: "Today's best candidates won't wait long — shortlist now before your competitors do.",
          button_text: 'Review Candidates',
          button_url: '/employer/dashboard',
        },
      },
      {
        key: 'daily_night_job_seeker',
        audience: 'job_seeker',
        label: '🌙 Good Night 9:30 PM (job seeker)',
        description: 'Sent every day at 9:30 PM IST to job seekers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '🌙 Good Night, {{name}}!',
          body: 'While you rest, employers review profiles — update yours tonight so they find you first.',
          button_text: 'Update Profile',
          button_url: '/profile',
        },
      },
      {
        key: 'daily_night_employer',
        audience: 'employer',
        label: '🌙 Good Night 9:30 PM (employer)',
        description: 'Sent every day at 9:30 PM IST to employers active in the last 30 days. The saved wording is sent as-is.',
        variables: [V.name],
        defaults: {
          title: '🌙 Good Night, {{name}}!',
          body: 'Your jobs keep working while you sleep — wake up to a pipeline full of applicants.',
          button_text: 'Open Dashboard',
          button_url: '/employer/dashboard',
        },
      },
    ],
  },
];


/** Template groups for one Telegram bot audience. */
export const groupsForAudience = (audience: 'job_seeker' | 'employer'): PushTemplateGroup[] =>
  PUSH_TEMPLATE_GROUPS
    .map((g) => ({ ...g, events: g.events.filter((e) => audienceOf(e) === 'both' || audienceOf(e) === audience) }))
    .filter((g) => g.events.length > 0);

export const ALL_PUSH_TEMPLATES: PushTemplateDef[] = PUSH_TEMPLATE_GROUPS.flatMap((g) => g.events);

/** Template groups visible for one channel (channel-only messages stay on Telegram). */
export const groupsForChannel = (
  channel: 'push' | 'email' | 'telegram',
  audience?: 'job_seeker' | 'employer',
): PushTemplateGroup[] =>
  PUSH_TEMPLATE_GROUPS
    .map((g) => ({
      ...g,
      events: g.events.filter((e) => {
        if (channel !== 'telegram' && e.telegramOnly) return false;
        if (channel !== 'email' && e.emailOnly) return false;
        if (channel === 'email' && e.noEmail) return false;
        if (channel === 'email' && (e.key === 'subscribe' || e.key === 'unsubscribe')) return false;
        return !audience || audienceOf(e) === 'both' || audienceOf(e) === audience;
      }),
    }))
    .filter((g) => g.events.length > 0);

/**
 * Event names used across the app / edge functions that must reuse an existing
 * template. Without this map those pushes would find no template row and go out
 * as plain text with no real data.
 */
export const PUSH_EVENT_ALIASES: Record<string, string> = {
  job_expiring: 'job_expiry',
  referral_reward: 'commission_earned',
  withdrawal_approved: 'referral_withdrawal',
  employer_withdrawal_failed: 'referral_withdrawal',
  payment_received: 'payment_success',
  candidate_shortlisted: 'application_shortlisted',
  telegram_2fa_otp: 'jobseeker_2fa_otp',
  employer_telegram_2fa_otp: 'employer_2fa_otp',
  user_refund_initiated: 'refund_initiated',
  user_subscription_expiring: 'subscription_expiring',
  employer_subscription_expiring: 'subscription_expiring',
  job_digest: 'weekly_digest',
  welcome: 'signup_welcome',
  user_signup_welcome: 'signup_welcome',
  employer_welcome: 'employer_signup_welcome',
  profile_completed: 'profile_complete',
  user_profile_completed: 'profile_complete',
  company_profile_complete: 'profile_complete',
  application_reviewed: 'application_under_review',
  application_under_review_status: 'application_under_review',
  application_selected: 'application_hired',
  application_status: 'application_status_changed',
  status_change: 'application_status_changed',

  interview_scheduled: 'interview_status_update',
  interview_rescheduled: 'interview_status_update',
  interview_cancelled: 'interview_status_update',
  interview_completed: 'interview_status_update',
  employer_interview_cancelled: 'employer_interview_scheduled',
  employer_interview_completed: 'employer_interview_scheduled',
  employer_job_posted: 'job_posted',
  job_live: 'job_posted',
  payment_successful: 'payment_success',
  employer_payment_success: 'payment_success',
  employer_payment_successful: 'payment_success',
  employer_payment_failed: 'payment_failed',
  wallet_points_added: 'wallet_credit',
  points_added: 'wallet_credit',
  milestone_achieved: 'referral_milestone',
  user_withdrawal_approved: 'referral_withdrawal',
  employer_withdrawal_approved: 'referral_withdrawal',
  user_withdrawal_failed: 'referral_withdrawal',
  withdrawal_status: 'referral_withdrawal',
  // Events that had no owner template mapping, so they used to fall back to
  // generated text. They now reuse the closest saved template.
  interview_reminder: 'application_interview_scheduled',
  employer_interview_reminder: 'employer_interview_scheduled',
  interview_reminder_employer: 'employer_interview_scheduled',
  job_recommendation: 'new_job_match',
  job_alert: 'new_job_match',
  new_jobs_for_you: 'new_job_match',
  user_payment_success: 'payment_success',
  user_payment_failed: 'payment_failed',
  payment_failure: 'payment_failed',
  employer_profile_completed: 'profile_complete',
  employer_signup_otp_sent: 'employer_2fa_otp',
  signup_otp: 'jobseeker_2fa_otp',
  otp_sent: 'jobseeker_2fa_otp',
  user_telegram_connected: 'bot_code_used_job_seeker',
  employer_telegram_connected: 'bot_code_used_employer',
  application_received: 'new_application_received',
  job_application_received: 'new_application_received',
  referral_signup: 'referral_join',
  referral_joined: 'referral_join',
  commission_credited: 'commission_earned',
  job_expiring_soon: 'job_expiry',
  boost_expiring_soon: 'boost_expiry',
  domain_expiring_soon: 'domain_expiry',
  verification_expiring_soon: 'verification_expiry',
  user_referral_reward: 'commission_earned',
  employer_referral_reward: 'commission_earned',
  user_referral_invite: 'referral_join',
  employer_referral_invite: 'referral_join',
  user_signup_otp: 'jobseeker_2fa_otp',
  user_signup_otp_sent: 'jobseeker_2fa_otp',
  company_signup_otp: 'employer_2fa_otp',
  user_profile_whatsapp_verify: 'jobseeker_2fa_otp',
  company_profile_whatsapp_verify: 'employer_2fa_otp',
  profile_incomplete: 'profile_incomplete_job_seeker',
  user_profile_incomplete: 'profile_incomplete_job_seeker',
  employer_profile_incomplete: 'profile_incomplete_employer',
  company_profile_incomplete: 'profile_incomplete_employer',
  employer_job_expiring: 'job_expiry',
  employer_job_expiry: 'job_expiry',
  low_balance: 'employer_low_balance',
  employer_low_points: 'employer_low_balance',
  user_profile_viewed: 'profile_viewed',
  employer_viewed_profile: 'profile_viewed',
};

/**
 * Each application status now has its own template instead of one shared
 * "status changed" message. Keep this map in sync with the copy in
 * supabase/functions/email-api/index.ts.
 */
export const APPLICATION_STATUS_TEMPLATES: Record<string, string> = {
  reviewed: 'application_under_review',
  under_review: 'application_under_review',
  in_review: 'application_under_review',
  shortlisted: 'application_shortlisted',
  interview_scheduled: 'application_interview_scheduled',
  interview: 'application_interview_scheduled',
  hired: 'application_hired',
  selected: 'application_hired',
  rejected: 'application_rejected',
  not_selected: 'application_rejected',
  withdrawn: 'application_withdrawn',
};

/** Template key for one application status (falls back to the generic one). */
export const applicationStatusTemplateKey = (status: string): string =>
  APPLICATION_STATUS_TEMPLATES[String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')] ??
  'application_status_changed';


/** Map any app event name to the template key that should be used. */
export const resolveTemplateKey = (eventKey: string): string => {
  const key = (eventKey || '').replace(/^push_/, '');
  return PUSH_EVENT_ALIASES[key] ?? key;
};

/** Every variable (event-specific + common) available for a template. */
export const variablesFor = (def: PushTemplateDef): PushTemplateVariable[] =>
  Array.from(new Map([
    ...def.variables,
    ...(def.key in PAYMENT_EMAIL_DEFAULTS ? PAYMENT_EMAIL_VARIABLES : []),
    ...(def.key in PAYPAL_EMAIL_DEFAULTS ? PAYPAL_EMAIL_VARIABLES : []),
    ...COMMON_VARIABLES,
  ].map((variable) => [variable.key, variable])).values());

/** Sample values used by the "Send test to me" button. */
export const sampleValuesFor = (def: PushTemplateDef): Record<string, string> =>
  ({
    ...Object.fromEntries(variablesFor(def).map((v) => [v.key, v.sample])),
    whatsapp: V.whatsapp.sample,
    ...(def.key === 'payment_failed' ? { status: 'Failed' } :
      def.key === 'payment_refund' ? { status: 'Refunded' } :
      def.key === 'paypal_payment_failed' ? { status: 'Failed' } :
      def.key === 'paypal_payment_refund' ? { status: 'Refunded' } : {}),
  });

const TITLE_CASE_VARIABLES = new Set(['name', 'job_title', 'company', 'status', 'mode']);

/** Keep names and short labels readable, without changing IDs, dates, URLs or email addresses. */
const formatTemplateValue = (key: string, value: string): string => {
  if (PAYMENT_EMAIL_VARIABLES.some((v) => v.key === key)) return value.trim();
  const clean = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!TITLE_CASE_VARIABLES.has(key)) return clean;
  return clean.replace(/(^|[\s/(-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
};

/**
 * Replace {{key}} placeholders. Lines that still contain an unresolved
 * placeholder after replacement are dropped entirely, so an empty
 * "Mobile : " line never reaches the user.
 */
export const applyVariables = (text: string, values: Record<string, string | undefined>): string => {
  if (!text) return '';
  let out = text;
  const mobileDigits = String(values.mobile || '').replace(/\D/g, '');
  const whatsapp = String(values.whatsapp || values.mobile || '').trim();
  const whatsappDigits = whatsapp.replace(/\D/g, '');
  const expandedValues = {
    ...values,
    ...(whatsapp ? { whatsapp } : {}),
    ...(mobileDigits ? { mobile_digits: mobileDigits } : {}),
    ...(whatsappDigits ? { whatsapp_digits: whatsappDigits } : {}),
  };
  for (const [key, value] of Object.entries(expandedValues)) {
    const v = value == null ? '' : formatTemplateValue(key, String(value));
    if (!v) continue;
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), v);
  }
  return out
    .split('\n')
    .filter((line) => !/\{\{\s*[\w.]+\s*\}\}/.test(line))
    .join('\n')
    .trim();
};

/**
 * Email-only defaults. Emails are fully designed HTML messages built from the
 * shared blocks in emailTemplateDesign.ts, so every template looks like one
 * branded mail instead of a plain message. The content of each template lives
 * in emailTemplateContent.ts and stays editable from Owner Portal → Email
 * Templates. Any event without an entry there falls back to `def.defaults`.
 */
export const EMAIL_TEMPLATE_DEFAULTS: Record<
  string,
  { title: string; body: string; button_text: string; button_url: string }
> = Object.fromEntries(
  Object.entries(EMAIL_CONTENT_SPECS).map(([key, spec]) => [key, emailTemplateFromSpec(spec)]),
);

/** Defaults for the Email Templates screen (richer text when available). */
export const emailDefaultsFor = (def: PushTemplateDef) =>
  PAYMENT_EMAIL_DEFAULTS[def.key] ?? PAYPAL_EMAIL_DEFAULTS[def.key] ?? EMAIL_TEMPLATE_DEFAULTS[def.key] ?? def.defaults;

/**
 * Telegram-only defaults. A Telegram message can carry a short explanation
 * (like the email templates do) without becoming as long as an email, so every
 * Telegram template gets a one or two line description under the details.
 * Telegram supports basic HTML (<b>, <i>, <code>, <a>).
 * Any event without an entry here falls back to `def.defaults`.
 */
export const TELEGRAM_TEMPLATE_DEFAULTS: Record<
  string,
  { title: string; body: string; button_text: string; button_url: string }
> = {
  subscribe: {
    title: '🔔 Notifications Connected',
    body: 'Hi {{name}}, your Telegram is now linked to Workly India.\n\nYou will receive job matches, application updates and important account alerts right here.\n\n🗓️ {{date}}  ⏰ {{time}}',
    button_text: 'Explore Jobs',
    button_url: '/jobs',
  },
  unsubscribe: {
    title: '🔕 Notifications Disconnected',
    body: 'Hi {{name}}, Telegram alerts have been turned off.\n\nYou may miss job matches and application updates. You can turn them back on any time from your profile.\n\n🗓️ {{date}}  ⏰ {{time}}',
    button_text: 'Turn On Again',
    button_url: '/notifications',
  },
  jobseeker_2fa_otp: {
    title: '🔐 Two-Factor Authentication',
    body: 'Hi {{name}},\n\nYour job seeker login code is <b>{{otp}}</b>\nValid for {{expiry_minutes}} minutes.\n\n<i>Never share this code with anyone. Our team will never ask you for it.</i>',
    button_text: '',
    button_url: '/',
  },
  employer_2fa_otp: {
    title: '🔐 Two-Factor Authentication',
    body: 'Hi {{name}},\n\nYour employer login code is <b>{{otp}}</b>\nValid for {{expiry_minutes}} minutes.\n\n<i>Never share this code with anyone. Our team will never ask you for it.</i>',
    button_text: '',
    button_url: '/',
  },
  signup_welcome: {
    title: '🎉 Welcome to Workly India',
    body: 'Hi {{name}}, your job seeker account is ready.\n\n📍 {{location}}\n🗓️ Joined {{date}} at {{time}}\n\n<i>Complete your profile and upload your resume — complete profiles are shown to employers first and can apply to any job in one tap.</i>',
    button_text: 'Complete Profile',
    button_url: '/profile',
  },
  employer_signup_welcome: {
    title: '🎉 Welcome to Workly India',
    body: 'Hi {{name}}, your employer account is ready.\n\n🏢 {{company}}\n🗓️ Joined {{date}} at {{time}}\n\n<i>Complete your company profile and post your first job — verified, complete profiles receive far more applications.</i>',
    button_text: 'Post a Job',
    button_url: '/employer-portal',
  },
  profile_complete: {
    title: '✅ Profile Complete',
    body: 'Well done {{name}}, your profile is 100% complete.\n\n<i>Complete profiles rank higher in employer searches, and you can now apply to any job with a single tap.</i>',
    button_text: 'Browse Jobs',
    button_url: '/jobs',
  },
  profile_incomplete_job_seeker: {
    title: '📋 Profile Incomplete',
    body: 'Hi <b>{{name}}</b>,\n\nYour profile is still incomplete.\n\n<i>Complete profiles get up to 3x more visibility with employers and let you apply with a single tap.</i>',
    button_text: 'Complete Profile',
    button_url: '/profile',
  },
  profile_incomplete_employer: {
    title: '🏢 Company Profile Incomplete',
    body: 'Hi <b>{{name}}</b>,\n\nYour company profile is still incomplete.\n\n<i>Complete, verified company profiles build trust and attract far better candidates.</i>',
    button_text: 'Complete Profile',
    button_url: '/employer-portal',
  },
  resume_builder_promo: {
    title: '📄 Build a job-winning resume in minutes',
    body: 'Hi <b>{{name}}</b> 👋\n\n<b>Choose a free resume template</b>\n<i>ATS friendly designs that recruiters love</i>\n\n━━━━━━━━━━━━\n\n{{resume_templates}}',
    button_text: 'Create Resume',
    button_url: '/resume-builder/create/1',
  },
  cover_letter_builder_promo: {
    title: '✉️ Write a standout cover letter',
    body: 'Hi <b>{{name}}</b> 👋\n\n<b>Choose a free cover letter template</b>\n<i>Get noticed by employers faster</i>\n\n━━━━━━━━━━━━\n\n{{cover_templates}}',
    button_text: 'Create Cover Letter',
    button_url: '/cover-letter-builder/create/1',
  },
  developer_platform_promo: {
    title: '🚀 Build faster with Workly India APIs',
    body: 'Hi <b>{{name}}</b> 👋\n\n<b>Everything your team needs to add jobs, messaging and sign-in to your website</b>\n<i>Show live Workly India jobs with Email, WhatsApp, OAuth and Chat Widget APIs in one place</i>\n\n━━━━━━━━━━━━\n\n{{developer_services}}',
    button_text: 'Open Developer Portal',
    button_url: '/developers',
  },
  weekly_digest: {
    title: '🎯 {{job_count}} New Jobs Matched For You',
    body: 'Hi <b>{{name}}</b> 👋\n\n<b>Explore these jobs by top companies</b>\n<i>Picked for your skills, role and location</i>\n\n━━━━━━━━━━━━\n\n{{jobs_list}}\n\n━━━━━━━━━━━━\n\n😕 <b>Not getting relevant jobs?</b>\nUpdate your profile to get better matches.',
    button_text: 'View all recommendations',
    button_url: '/jobs',
  },
  application_submitted: {
    title: '✅ Application Sent',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>The employer can now see your profile. You will get an update here as soon as your status changes. Keep applying to similar roles — it gets you hired faster.</i>',
    button_text: 'View Activity',
    button_url: '/activity',
  },
  application_status_changed: {
    title: '📋 Application Update',
    body: '💼 {{job_title}}\n🏢 {{company}}\n📌 Status: {{status}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Keep your phone and email reachable so the employer can contact you without delay.</i>',
    button_text: 'View Activity',
    button_url: '/activity',
  },
  application_under_review: {
    title: '👀 Application Under Review',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>The hiring team is going through your profile and resume. If you are a good fit, they will shortlist you and may call you for an interview.</i>',
    button_text: 'View Activity',
    button_url: '/activity',
  },
  application_shortlisted: {
    title: '🎉 You Have Been Shortlisted',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>{{company}} has shortlisted you. Keep your phone reachable — they may call or email you soon to schedule an interview.</i>',
    button_text: 'View Activity',
    button_url: '/activity',
  },
  application_interview_scheduled: {
    title: '📅 Interview Scheduled',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{interview_date}}\n⏰ {{interview_time}}\n💻 Mode: {{mode}}\n\n<i>Join 10 minutes early, keep your resume and ID ready, and check your internet if it is a video interview.</i>',
    button_text: 'View Interview',
    button_url: '/activity',
  },
  application_hired: {
    title: '🎊 Congratulations, You Are Hired',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>{{company}} has selected you. They will contact you with your joining date and the documents required — keep your originals ready.</i>',
    button_text: 'View Activity',
    button_url: '/activity',
  },
  application_rejected: {
    title: '📋 Application Update',
    body: '💼 {{job_title}}\n🏢 {{company}}\n📌 Status: Not selected\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>This role did not work out, but many similar jobs are open for your skills. Candidates who keep applying get hired much faster.</i>',
    button_text: 'Browse Jobs',
    button_url: '/jobs',
  },
  interview_employer_joined: {
    title: '🎥 Interviewer Has Joined',
    body: '💼 {{job_title}}\n🏢 {{company}}\n💻 Mode: {{mode}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>The interviewer is waiting in the interview room. Join now from your Activity section, and keep your resume and ID ready.</i>',
    button_text: 'Join Interview',
    button_url: '/activity',
  },
  interview_started: {
    title: '🔴 Your Interview Has Started',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{interview_date}}\n⏰ {{interview_time}}\n💻 Mode: {{mode}}\n\n<i>Your interview time has begun. Join right away — check your internet, camera and microphone if it is a video interview.</i>',
    button_text: 'Join Now',
    button_url: '/activity',
  },
  application_withdrawn: {
    title: '↩️ Application Withdrawn',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>This application is no longer with the employer. If this was a mistake, you can apply again while the job is live.</i>',
    button_text: 'Browse Jobs',
    button_url: '/jobs',
  },
  application_viewed: {
    title: '👀 Your Application Was Viewed',
    body: '💼 {{job_title}}\n🏢 {{company}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your profile has reached the hiring team. Keep your resume updated and your phone reachable.</i>',
    button_text: 'View Activity',
    button_url: '/activity',
  },
  interview_status_update: {
    title: '📅 Interview Update',
    body: '💼 {{job_title}}\n🏢 {{company}}\n📌 Status: {{status}}\n🗓️ {{interview_date}}\n⏰ {{interview_time}}\n💻 Mode: {{mode}}\n\n<i>Join 10 minutes early and keep your resume and ID ready. If you cannot attend, inform the employer as early as possible.</i>',
    button_text: 'View Interview',
    button_url: '/activity',
  },
  new_job_match: {
    title: '🔥 New Job Match',
    body: '💼 {{job_title}}\n🏢 {{company}}\n📍 {{location}}\n🗓️ Posted {{date}} at {{time}}\n\n<i>This job matches the skills and location in your profile. Apply early — employers usually review the first applications they receive.</i>',
    button_text: 'View & Apply',
    button_url: '/jobs',
  },
  new_application_received: {
    title: '📥 New Application Received',
    body: '💼 {{job_title}}\n👤 {{name}}\n📱 {{mobile}}\n💬 <a href="https://wa.me/{{whatsapp_digits}}">{{whatsapp}}</a>\n📧 <a href="mailto:{{email}}">{{email}}</a>\n📍 {{location}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Review the candidate in your Employer Portal and shortlist or schedule an interview — employers who reply within 48 hours hire noticeably faster.</i>',
    button_text: 'Review Applicant',
    button_url: '/employer-portal',
  },
  job_posted: {
    title: '🚀 Your Job Is Live',
    body: '💼 {{job_title}}\n📍 {{location}}\n🗓️ Published {{date}} at {{time}}\n\n<i>Your job now appears in search results and job alerts. Boost it to stay at the top and reach many more candidates.</i>',
    button_text: 'Manage Job',
    button_url: '/employer-portal',
  },
  payment_success: {
    title: '✅ Payment Successful',
    body: '💰 Amount: {{amount}}\n🧾 Order ID: {{order_id}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your purchase is active. Keep the Order ID safe — support will ask for it if you ever need help with this payment.</i>',
    button_text: 'View Payment History',
    button_url: '/payment-history',
  },
  payment_failed: {
    title: '❌ Payment Failed',
    body: '💰 Amount: {{amount}}\n🧾 Order ID: {{order_id}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>No service was activated. Please try again with UPI, card or net banking. If money was deducted, banks reverse failed payments within 5-7 working days.</i>',
    button_text: 'Try Again',
    button_url: '/payment-history',
  },
  wallet_credit: {
    title: '💰 Payment Received',
    body: '💳 Amount paid: {{amount}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your Razorpay payment was successful. You can now post jobs, boost an opening, extend an expiring job or apply for company verification.</i>',
    button_text: 'View Payment History',
    button_url: '/payment-history',
  },
  wallet_points_debited: {
    title: '🔻 Service Purchase Confirmed',
    body: '💳 Amount paid: {{amount}}\n🛒 For: {{item}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your service is being processed. You can see every payment in your payment history.</i>',
    button_text: 'Payment History',
    button_url: '/payment-history',
  },
  google_bing_publish_activated: {
    title: '🌐 Published on Google & Bing',
    body: '💼 Job: {{job_title}}\n💳 Paid: {{amount}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your job has been sent to Google & Bing and will show in search results soon.</i>',
    button_text: 'View Job',
    button_url: '/employer-portal',
  },
  job_boost_activated: {
    title: '🚀 Job Boost Activated',
    body: '💼 Job: {{job_title}}\n📦 Package: {{item}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your job now appears at the top of search results and reaches more candidates.</i>',
    button_text: 'View Job',
    button_url: '/employer-portal',
  },
  verification_badge_activated: {
    title: '✅ Verified Badge Activated',
    body: '🏢 Company: {{company}}\n🏅 Badge: {{item}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Candidates now see your company as verified, which builds trust and brings more applications.</i>',
    button_text: 'View Company',
    button_url: '/employer-portal',
  },
  ai_plan_activated: {
    title: '🤖 AI Plan Activated',
    body: '📦 Plan: {{plan}}\n💰 Amount: {{amount}}\n📆 Valid till: {{expiry_date}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your AI assistant is ready with all plan features unlocked.</i>',
    button_text: 'Open AI Chat',
    button_url: '/ai-chat',
  },
  referral_join: {
    title: '🎉 New Referral Joined',
    body: '👤 {{referral_name}}\n📍 {{location}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your reward is credited as per the referral programme rules. Keep sharing your link — more referrals unlock milestone rewards too.</i>',
    button_text: 'View Referrals',
    button_url: '/referral',
  },
  referral_milestone: {
    title: '🎯 Referral Milestone Unlocked',
    body: '🏅 Milestone: {{rank}}\n🎁 Reward: {{amount}}\n👛 Balance: {{balance}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your reward has been added to your wallet. Keep inviting genuine users to unlock bigger milestones.</i>',
    button_text: 'View Referrals',
    button_url: '/referral',
  },
  commission_earned: {
    title: '💸 Referral Earning Credited',
    body: '💰 Amount: {{amount}}\n👤 From: {{referral_name}}\n👛 Balance: {{balance}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>This amount is now part of your withdrawable balance, subject to the minimum withdrawal limit.</i>',
    button_text: 'View Earnings',
    button_url: '/referral',
  },
  referral_withdrawal: {
    title: '🏦 Withdrawal Update',
    body: '💰 Amount: {{amount}}\n📌 Status: {{status}}\n👛 Balance: {{balance}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Approved payouts usually reach your bank or UPI within 1-3 working days. Make sure your payout details match your own verified account.</i>',
    button_text: 'View Withdrawals',
    button_url: '/referral',
  },
  referral_competition_win: {
    title: '🏆 You Won a Prize',
    body: '🥇 Rank: {{rank}}\n🎁 Prize: {{prize}}\n🗓️ {{date}}  ⏰ {{time}}\n\n<i>Your prize is credited to your wallet after the standard verification of referral activity. The competition runs every month — keep sharing your link.</i>',
    button_text: 'View Rewards',
    button_url: '/referral',
  },
  job_expiry: {
    title: '⏰ Job Post Expiring Soon',
    body: '💼 {{job_title}}\n🗓️ Expires on {{expiry_date}}\n\n<i>After expiry the job leaves search results and alerts, and candidates can no longer apply. Extend it to keep the same post and all applications received so far.</i>',
    button_text: 'Extend Job',
    button_url: '/employer-portal',
  },
  boost_expiry: {
    title: '⏰ Job Boost Ending',
    body: '💼 {{job_title}}\n🗓️ Boost ends on {{expiry_date}}\n\n<i>When the boost ends your job leaves the top positions in search and alerts. Boosted jobs get several times more views — renew to keep the momentum.</i>',
    button_text: 'Renew Boost',
    button_url: '/employer-portal',
  },
  verification_expiry: {
    title: '⏰ Verified Badge Expiring',
    body: '🏢 {{company}}\n🗓️ Expires on {{expiry_date}}\n\n<i>Candidates apply far more often to verified companies. If the badge expires it is removed from your profile and all job posts until you renew.</i>',
    button_text: 'Renew Verification',
    button_url: '/employer-portal',
  },
  domain_expiry: {
    title: '⏰ Domain Expiring',
    body: '🌐 {{domain}}\n🗓️ Expires on {{expiry_date}}\n💰 Renewal: {{amount}}\n\n<i>After expiry your website and email on this domain stop working, and once the grace period ends someone else can register it.</i>',
    button_text: 'Renew Domain',
    button_url: '/domains',
  },
  ai_plan_expiry: {
    title: '⏰ AI Plan Expiring',
    body: '⭐ Plan: {{plan}}\n🗓️ Expires on {{expiry_date}}\n💰 Renewal: {{amount}}\n\n<i>After expiry premium AI features stop and usage returns to the free limits. Your chat history stays safe and returns when you renew.</i>',
    button_text: 'Renew Plan',
    button_url: '/ai-assistant/subscription',
  },
};

/** Defaults for the Telegram Templates screen (short description when available). */
export const telegramDefaultsFor = (def: PushTemplateDef) =>
  TELEGRAM_TEMPLATE_DEFAULTS[def.key] ?? def.defaults;
