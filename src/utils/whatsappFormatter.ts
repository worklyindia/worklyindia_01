/**
 * WhatsApp Message Formatter
 * Formats job listings for WhatsApp messages with proper structure
 */

import { CANONICAL_URL } from '@/config/domainConfig';

interface JobForWhatsApp {
  id: string;
  title: string;
  location?: string;
  city?: string;
  state?: string;
  job_type?: string;
  experience_level?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  category?: string;
  company_name?: string;
  short_id?: string;
  public_slug?: string;
}

/**
 * Formats a single job for WhatsApp message
 */
export const formatJobForWhatsApp = (job: JobForWhatsApp, index?: number): string => {
  const parts: string[] = [];

  // Job number (if provided)
  if (index !== undefined) {
    parts.push(`${index}. 🎯 *${job.title}*`);
  } else {
    parts.push(`🎯 *${job.title}*`);
  }

  // Location
  if (job.city && job.state) {
    parts.push(`   📍 ${job.city}, ${job.state}`);
  } else if (job.location) {
    parts.push(`   📍 ${job.location}`);
  }

  // Job type and experience on same line
  const jobDetails: string[] = [];
  if (job.job_type) {
    jobDetails.push(job.job_type);
  }
  if (job.experience_level) {
    jobDetails.push(job.experience_level);
  }
  if (jobDetails.length > 0) {
    parts.push(`   💼 ${jobDetails.join(' | ')}`);
  }

  // Salary
  if (job.salary_min && job.salary_max) {
    const currency = job.salary_currency || '₹';
    const period = job.salary_period === 'monthly' ? '/month' : 
                   job.salary_period === 'yearly' ? '/year' : '';
    parts.push(`   💰 ${currency}${job.salary_min.toLocaleString()} - ${currency}${job.salary_max.toLocaleString()}${period}`);
  }

  // Company
  if (job.company_name) {
    parts.push(`   🏢 ${job.company_name}`);
  }

  // Category
  if (job.category) {
    parts.push(`   📂 ${job.category}`);
  }

  // Link - use short URL if available, then SEO slug, then fallback to ID
  const jobUrl = job.short_id 
    ? `${CANONICAL_URL}/j/${job.short_id}`
    : `${CANONICAL_URL}/job/${job.public_slug || job.id}`;
  
  parts.push(`   👉 Apply: ${jobUrl}`);
  parts.push(''); // Empty line for spacing

  return parts.join('\n');
};

/**
 * Formats multiple jobs for WhatsApp message
 */
export const formatJobsForWhatsApp = (jobs: JobForWhatsApp[], header?: string): string => {
  const messages: string[] = [];

  // Header
  if (header) {
    messages.push(header);
    messages.push('');
  }

  // Format each job
  jobs.forEach((job, index) => {
    messages.push(formatJobForWhatsApp(job, index + 1));
  });

  // Footer
  messages.push('✨ *Workly India* - Remote Jobs');
  messages.push(`🌐 ${CANONICAL_URL}`);

  return messages.join('\n');
};

/**
 * Generates WhatsApp share message for a single job
 */
export const generateWhatsAppShareMessage = (job: JobForWhatsApp): string => {
  return formatJobsForWhatsApp([job], '🔥 *Check out this job opportunity!*');
};

/**
 * Example usage:
 * 
 * const message = formatJobsForWhatsApp([
 *   {
 *     id: '123',
 *     title: 'Software Engineer',
 *     city: 'Mumbai',
 *     state: 'Maharashtra',
 *     job_type: 'Full Time',
 *     experience_level: '3-5 years',
 *     salary_min: 50000,
 *     salary_max: 80000,
 *     company_name: 'Tech Corp',
 *     category: 'IT & Software',
 *     short_id: 'abc123'
 *   }
 * ], '🚀 *Latest Job Openings*');
 */
