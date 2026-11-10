/**
 * Job Application Service - Single Source of Truth
 * All job applications MUST go through this service to ensure consistency
 * Uses RPC function to bypass PostgREST schema cache issues
 */

import { supabase } from '@/integrations/supabase/client';

export interface GuestApplicationData {
  name: string;
  whatsapp_number: string;
  email: string;
  phone?: string;
  bio?: string;
  location?: string;
}

export interface ProfileApplicationData {
  full_name?: string;
  phone?: string;
  whatsapp_number?: string;
  location?: string;
  current_position?: string;
  company?: string;
  experience_years?: number;
  skills?: string[];
  education?: string;
  bio?: string;
}

export interface ApplicationResult {
  success: boolean;
  applicationId?: string;
  error?: string;
  errorCode?: 'ALREADY_APPLIED' | 'EMPLOYER_NOT_FOUND' | 'PERMISSION_DENIED' | 'UNKNOWN';
}

// Build version for cache debugging
export const BUILD_VERSION = '2.0.1-' + Date.now().toString(36);

/**
 * Submit job application using RPC (bypasses PostgREST cache issues)
 * This is the ONLY method that should be used for job applications
 */
export async function submitJobApplication(
  jobId: string,
  applicantId: string | null,
  coverLetter: string,
  guestData?: {
    fullName?: string;
    whatsappNumber?: string;
    email?: string;
    phone?: string;
    bio?: string;
    location?: string;
  },
  source: string = 'website'
): Promise<ApplicationResult> {
  console.log(`[JobAppService v${BUILD_VERSION}] Submitting application via RPC`, {
    jobId,
    hasApplicantId: !!applicantId,
    isGuest: !applicantId,
    source
  });

  try {
    const { data: applicationId, error } = await supabase.rpc('submit_job_application', {
      p_job_id: jobId,
      p_applicant_id: applicantId,
      p_cover_letter: coverLetter,
      p_api_full_name: guestData?.fullName || null,
      p_api_whatsapp_number: guestData?.whatsappNumber || null,
      p_api_email: guestData?.email || null,
      p_api_phone: guestData?.phone || null,
      p_api_bio: guestData?.bio || null,
      p_api_location: guestData?.location || null,
      p_application_source: source
    });

    if (error) {
      console.error(`[JobAppService v${BUILD_VERSION}] RPC error:`, error);
      
      // Parse error type
      if (error.message?.includes('already applied')) {
        return { success: false, error: 'You have already applied for this job', errorCode: 'ALREADY_APPLIED' };
      }
      if (error.message?.includes('employer') || error.message?.includes('company')) {
        return { success: false, error: 'Unable to submit application - company information not found', errorCode: 'EMPLOYER_NOT_FOUND' };
      }
      if (error.code === '42501' || error.message?.includes('policy')) {
        return { success: false, error: 'Permission denied. Please contact support.', errorCode: 'PERMISSION_DENIED' };
      }
      
      return { success: false, error: error.message || 'Unknown error', errorCode: 'UNKNOWN' };
    }

    console.log(`[JobAppService v${BUILD_VERSION}] Application submitted successfully:`, applicationId);

    // Notifications (applicant confirmation + employer alert with applicant details)
    // are dispatched instantly by the database trigger on job_applications.


    return { success: true, applicationId };
  } catch (err) {
    console.error(`[JobAppService v${BUILD_VERSION}] Exception:`, err);
    return { success: false, error: 'An unexpected error occurred', errorCode: 'UNKNOWN' };
  }
}

/**
 * Helper to build cover letter from guest data
 */
export function buildGuestCoverLetter(guestInfo: GuestApplicationData): string {
  let letter = `Guest Application\n\nName: ${guestInfo.name}\nWhatsApp: ${guestInfo.whatsapp_number}\nEmail: ${guestInfo.email}`;
  
  if (guestInfo.phone) letter += `\nPhone: ${guestInfo.phone}`;
  if (guestInfo.location) letter += `\nLocation: ${guestInfo.location}`;
  if (guestInfo.bio) letter += `\nAbout: ${guestInfo.bio}`;
  
  return letter;
}

/**
 * Helper to build cover letter from profile data
 */
export function buildProfileCoverLetter(profile: ProfileApplicationData): string {
  return `Application from ${profile.full_name || 'User'}
            
Phone: ${profile.phone || 'Not provided'}
WhatsApp: ${profile.whatsapp_number || profile.phone || 'Not provided'}
Location: ${profile.location || 'Not provided'}
Current Position: ${profile.current_position || 'Not specified'}
Company: ${profile.company || 'Not specified'}
Experience: ${profile.experience_years ? profile.experience_years + ' years' : 'Not specified'}
Skills: ${profile.skills ? profile.skills.join(', ') : 'Not specified'}
Education: ${profile.education || 'Not specified'}
Bio: ${profile.bio || 'Not provided'}`;
}
