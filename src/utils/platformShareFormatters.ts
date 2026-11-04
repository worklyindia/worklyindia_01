/**
 * Platform-Specific Share Formatters
 * 
 * Each platform has different optimal formats for viral sharing:
 * - WhatsApp: Rich formatted text with emojis and structure
 * - Facebook: Short engaging text with URL (relies on OG tags)
 * - Twitter/X: Concise with hashtags (280 char limit)
 * - LinkedIn: Professional tone with call-to-action
 * 
 * All messages are in English only for professional, trustworthy sharing.
 * SEO-friendly URLs ensure proper link previews on all platforms.
 */

import { CANONICAL_URL, getJobShareUrl } from '@/config/domainConfig';

interface JobShareData {
  id: string;
  title: string;
  company_name?: string;
  city?: string;
  state?: string;
  location?: string;
  job_type?: string;
  experience_level?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  category?: string;
  short_id?: string;
  public_slug?: string;
}

/**
 * Format salary string consistently across platforms
 */
const formatSalary = (job: JobShareData): string | null => {
  if (!job.salary_min || !job.salary_max) return null;
  const currency = job.salary_currency || '₹';
  const period = job.salary_period === 'monthly' ? '/month' : 
                 job.salary_period === 'yearly' ? '/year' : '';
  return `${currency}${job.salary_min.toLocaleString('en-IN')} - ${currency}${job.salary_max.toLocaleString('en-IN')}${period}`;
};

/**
 * Get location text consistently
 */
const getLocationText = (job: JobShareData): string => {
  if (job.city && job.state) return `${job.city}, ${job.state}`;
  return job.location || 'Remote / Workly India';
};

// =============================================
// WHATSAPP - Rich formatted message with emojis
// =============================================
export const formatWhatsAppShare = (job: JobShareData, referralCode?: string, urlOverride?: string, salaryText?: string): string => {
  const jobUrl = urlOverride || (getJobShareUrl(job) + (referralCode ? `?ref=${referralCode}` : ''));
  
  const parts: string[] = [];
  
  // Professional header
  parts.push('🚀 *Job Opening - Apply Now!*');
  parts.push('');
  
  // Job title
  parts.push(`📌 *${job.title}*`);
  
  // Company
  if (job.company_name) {
    parts.push(`🏢 ${job.company_name}`);
  }
  
  // Location
  parts.push(`📍 ${getLocationText(job)}`);
  
  // Salary
  const salary = salaryText || formatSalary(job);
  if (salary) {
    parts.push(`💰 *${salary}*`);
  }
  
  // Job details
  const details: string[] = [];
  if (job.job_type) details.push(job.job_type);
  if (job.experience_level) details.push(job.experience_level);
  if (details.length > 0) {
    parts.push(`💼 ${details.join(' • ')}`);
  }
  
  // Category
  if (job.category) {
    parts.push(`📂 ${job.category}`);
  }
  
  parts.push('');
  
  // Trust signals
  parts.push('✅ Free to Apply');
  parts.push('✅ Verified Employer');
  parts.push('✅ Workly India');
  
  parts.push('');
  
  // Call to action
  parts.push(`👉 *Apply Here:* ${jobUrl}`);
  
  parts.push('');
  
  // Professional footer
  parts.push('━━━━━━━━━━━━━━━');
  parts.push('📱 *Workly India* - Remote Jobs');
  parts.push(`🌐 ${CANONICAL_URL}`);
  
  return parts.join('\n');
};

// =============================================
// FACEBOOK - Short engaging text (OG tags do the work)
// Facebook auto-fetches og:title, og:description, og:image
// from the shared URL. Keep text minimal and engaging.
// =============================================
export const formatFacebookShare = (job: JobShareData, referralCode?: string): string => {
  const parts: string[] = [];
  
  // Engaging hook
  parts.push(`🚀 ${job.title}${job.company_name ? ` at ${job.company_name}` : ''} - Now Hiring!`);
  parts.push('');
  
  // Quick highlights
  const highlights: string[] = [];
  const salary = formatSalary(job);
  if (salary) highlights.push(`💰 ${salary}`);
  if (job.job_type) highlights.push(`💼 ${job.job_type}`);
  highlights.push(`📍 ${getLocationText(job)}`);
  
  parts.push(highlights.join(' | '));
  parts.push('');
  
  parts.push('✅ Workly India | Free to Apply | Verified Employer');
  parts.push('');
  parts.push('#WorklyIndia #Jobs #Hiring #WorklyIndia #WorklyIndia #IndiaJobs');
  
  return parts.join('\n');
};

// =============================================
// TWITTER/X - Concise with hashtags (280 chars)
// Twitter auto-generates card preview from og/twitter meta tags.
// Keep tweet text short, URL will show preview card.
// =============================================
export const formatTwitterShare = (job: JobShareData, referralCode?: string): string => {
  const jobUrl = getJobShareUrl(job) + (referralCode ? `?ref=${referralCode}` : '');
  
  const parts: string[] = [];
  
  // Main content - keep concise
  parts.push(`🚀 Hiring: ${job.title}`);
  
  if (job.company_name) {
    parts.push(`at ${job.company_name}`);
  }
  
  // Salary highlight
  const salary = formatSalary(job);
  if (salary) {
    parts.push(`💰 ${salary}`);
  }
  
  parts.push('🏠 Workly India | Free to Apply');
  parts.push('');
  parts.push(`Apply: ${jobUrl}`);
  parts.push('');
  parts.push('#WorklyIndia #Jobs #Hiring #WorklyIndia');
  
  return parts.join('\n');
};

// =============================================
// LINKEDIN - Professional tone
// LinkedIn auto-fetches og:title, og:description, og:image.
// Text should be professional and add context beyond OG tags.
// =============================================
export const formatLinkedInShare = (job: JobShareData, referralCode?: string): string => {
  const jobUrl = getJobShareUrl(job) + (referralCode ? `?ref=${referralCode}` : '');
  
  const parts: string[] = [];
  
  // Professional hook
  parts.push('🎯 Exciting Career Opportunity!');
  parts.push('');
  
  // Job details
  parts.push(`📌 Position: ${job.title}`);
  if (job.company_name) {
    parts.push(`🏢 Company: ${job.company_name}`);
  }
  
  // Location
  parts.push(`📍 Location: ${getLocationText(job)}`);
  
  // Salary
  const salary = formatSalary(job);
  if (salary) {
    parts.push(`💵 Salary: ${salary}`);
  }
  
  // Experience
  if (job.experience_level) {
    parts.push(`📊 Experience: ${job.experience_level}`);
  }
  
  // Job type
  if (job.job_type) {
    parts.push(`💼 Type: ${job.job_type}`);
  }
  
  parts.push('');
  
  // Trust signals
  parts.push('✅ Free to Apply | Verified Employer | Workly India');
  parts.push('');
  
  parts.push(`🔗 Apply now: ${jobUrl}`);
  
  parts.push('');
  
  // Professional hashtags
  parts.push('#Hiring #JobOpening #WorklyIndia #RemoteJobs #CareerOpportunity #IndiaJobs');
  
  return parts.join('\n');
};

// =============================================
// INSTAGRAM - Visual-friendly caption
// =============================================
export const formatInstagramShare = (job: JobShareData, referralCode?: string): string => {
  const parts: string[] = [];
  
  // Eye-catching header
  parts.push('💼 JOB ALERT! 💼');
  parts.push('');
  
  // Job title prominent
  parts.push(`🎯 ${job.title.toUpperCase()}`);
  
  if (job.company_name) {
    parts.push(`🏢 ${job.company_name}`);
  }
  
  parts.push('');
  
  // Key details
  const salary = formatSalary(job);
  if (salary) {
    parts.push(`💰 ${salary}`);
  }
  
  parts.push('🏠 Workly India');
  parts.push('✅ Free to Apply');
  
  parts.push('');
  parts.push('📲 Link in bio to apply!');
  parts.push('');
  
  // Heavy hashtags for Instagram reach
  parts.push('#worklyindia #jobopening #hiring #worklyindia #worklyindiajobs #indiajobs #freshersjobs #jobsearch #career #opportunity #worklyindia');
  
  return parts.join('\n');
};

// =============================================
// COPY LINK - Clean summary for clipboard
// =============================================
export const formatCopyShare = (job: JobShareData, referralCode?: string): string => {
  const jobUrl = getJobShareUrl(job) + (referralCode ? `?ref=${referralCode}` : '');
  
  const parts: string[] = [];
  
  parts.push(`${job.title}${job.company_name ? ` at ${job.company_name}` : ''}`);
  
  const salary = formatSalary(job);
  if (salary) {
    parts.push(`Salary: ${salary}`);
  }
  
  parts.push(`${getLocationText(job)} | Workly India | Free to Apply`);
  parts.push(`Apply: ${jobUrl}`);
  
  return parts.join('\n');
};

// =============================================
// HELPER: Get share URL for each platform
// 
// Platform URL policies:
// - WhatsApp: wa.me with full text in ?text= param
// - Facebook: sharer.php with URL + quote param (OG tags fetched from URL)
// - Twitter: intent/tweet with text param (card generated from URL meta tags)
// - LinkedIn: share-offsite with URL only (OG tags fetched from URL)
// - Instagram: No direct share URL, copy to clipboard
// =============================================
export const getPlatformShareUrl = (
  platform: 'whatsapp' | 'facebook' | 'twitter' | 'linkedin' | 'instagram',
  job: JobShareData,
  referralCode?: string
): string => {
  const jobUrl = getJobShareUrl(job) + (referralCode ? `?ref=${referralCode}` : '');
  
  switch (platform) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(formatWhatsAppShare(job, referralCode))}`;
    
    case 'facebook':
      // Facebook fetches OG tags from the URL for link preview
      // quote param adds text above the preview card
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}&quote=${encodeURIComponent(formatFacebookShare(job, referralCode))}`;
    
    case 'twitter':
      // Twitter generates card preview from twitter:* and og:* meta tags
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(formatTwitterShare(job, referralCode))}`;
    
    case 'linkedin':
      // LinkedIn fetches OG tags from URL for rich preview
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;
    
    case 'instagram':
      // Instagram doesn't support direct URL sharing
      return '';
    
    default:
      return '';
  }
};
