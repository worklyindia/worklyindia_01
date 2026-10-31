import { useParams, useNavigate } from "react-router-dom";
import { storageImageUrl } from "@/utils/imageUrl";
import AddressMap from "@/components/AddressMap";
import { ArrowLeft, MapPin, Clock, DollarSign, Building, Heart, Phone, Briefcase, Share2, Flag, Lightbulb, MessageCircle, User, ChevronDown, ChevronUp, Copy, Map, Globe, Mail } from "lucide-react";
import LottieIcon from "@/components/LottieIcon";
import callAnimation from "@/assets/lottie/call.json";
import whatsappAnimation from "@/assets/lottie/whatsapp.json";
import emailAnimation from "@/assets/lottie/email.json";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ShareDialog from "@/components/ShareDialog";
import ReportJobDialog from "@/components/ReportJobDialog";
import JobTipsDialog from "@/components/JobTipsDialog";
import VideoDisplay from "@/components/VideoDisplay";
import SocialMediaIcons from "@/components/SocialMediaIcons";
import VerificationBadge from "@/components/VerificationBadge";
import { GuestApplicationDialog } from "@/components/GuestApplicationDialog";
import { JobImageGallery } from "@/components/job/JobImageGallery";
import ApplicationSuccessShare from "@/components/ApplicationSuccessShare";
import JobMarketInsightsPanel from "@/components/JobMarketInsightsPanel";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useJobInteractions } from "@/hooks/useJobInteractions";
import { useHybridFavorites } from "@/hooks/useHybridFavorites";
import { useHybridApplications } from "@/hooks/useHybridApplications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveApplicationToLocal } from "@/lib/localDataStorage";

import AdContainer from "@/components/ads/AdContainer";
import AdsterraNativeBanner from "@/components/ads/AdsterraNativeBanner";
import AdsterraBanner300x250 from "@/components/ads/AdsterraBanner300x250";
import { ADS_CONFIG } from "@/config/adsConfig";
import { formatDateWithTime } from "@/utils/dateFormatUtils";
import { formatSalaryWithPeriod } from "@/utils/salaryToINR";
import { useUserLocation } from "@/contexts/UserLocationContext";
import { calculateHaversineDistance } from "@/utils/locationUtils";
import { useMemo } from "react";
import { sanitizeHtml } from "@/utils/sanitize";
import { AnimatedJobBackground } from "@/components/job/AnimatedJobBackground";
import { triggerWhatsAppEvent } from "@/hooks/useWhatsAppTrigger";
import { submitJobApplication, buildGuestCoverLetter, buildProfileCoverLetter, BUILD_VERSION } from "@/lib/jobApplicationService";
import CompanyLogo from "@/components/company/CompanyLogo";
import { CANONICAL_URL } from '@/config/domainConfig';

const formatExperienceLevel = (level: string): string => {
  const levelMap: Record<string, string> = {
    'entry': 'Entry Level (0-2 years)',
    'junior': 'Junior Level (1-3 years)',
    'intermediate': 'Intermediate Level (3-5 years)',
    'mid': 'Mid Level (3-5 years)',
    'senior': 'Senior Level (5+ years)',
    'lead': 'Lead Level (7+ years)',
    'expert': 'Expert Level (10+ years)'
  };
  
  return levelMap[level?.toLowerCase()] || `${level} Experience`;
};

interface JobData {
  id: string;
  title: string;
  company_name?: string;
  company_id?: string;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  precise_address?: string;
  salary_range?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  job_type: string;
  experience_level: string;
  description: string;
  requirements?: string;
  benefits?: string;
  skills?: string[];
  languages?: string[];
  department?: string;
  category?: string;
  status: string;
  created_at: string;
  views_count?: number;
  applications_count?: number;
  short_id?: string;
  public_slug?: string;
  video_title_1?: string;
  video_url_1?: string;
  video_title_2?: string;
  video_url_2?: string;
  external_apply_url?: string;
  api_email?: string;
  api_hr_contact_name?: string;
  api_phone?: string;
  api_whatsapp_number?: string;
  api_company_name?: string;
  api_industry?: string;
  api_organisation_size?: string;
  api_company_description?: string;
  api_instagram_link?: string;
  api_facebook_link?: string;
  api_linkedin_link?: string;
  api_youtube_link?: string;
  openings?: number;
  application_deadline?: string;
  work_mode?: string;
  education_required?: string;
  shift_timing?: string;
  immediate_joining?: boolean;
  hiring_urgency?: string;
  apply_mode?: string;
  resume_required?: boolean;
  cover_letter_required?: boolean;
  auto_email_confirmation?: boolean;

  company?: {
    id?: string;
    user_id?: string;
    company_name: string;
    location?: string;
    industry?: string;
    company_size?: string;
    organisation_size?: string;
    description?: string;
    logo_url?: string;
    phone?: string;
    email?: string;
    whatsapp_number?: string;
    hr_contact_name?: string;
    instagram_link?: string;
    facebook_link?: string;
    youtube_link?: string;
    linkedin_link?: string;
    is_verified?: boolean;
    verified_plan_end?: string;
    badge_color?: string;
    verification_status?: string;
    latitude?: number;
    longitude?: number;
  };
}

// Helper to check if string is valid UUID
const isUuid = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

interface JobImage {
  id: string;
  image_url: string;
  image_type: 'uploaded' | 'ai_generated';
  size_category: 'banner' | 'square' | 'social';
  sort_order: number;
}

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [jobImages, setJobImages] = useState<JobImage[]>([]);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showFullRequirements, setShowFullRequirements] = useState(false);
  const [showFullBenefits, setShowFullBenefits] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { trackJobView, trackJobApply, trackJobCall, trackJobShare } = useJobInteractions();
  const { isFavorited, toggleFavorite } = useHybridFavorites();
  const { applications } = useHybridApplications();
const { user, profile } = useAuth();

  // Generate WhatsApp message based on user login status
  const generateWhatsAppMessage = () => {
    const jobTitle = jobData?.title || 'this position';
    const companyName = jobData?.api_company_name || jobData?.company?.company_name || 'your company';
    
    if (user && profile) {
      return `Hello,

I am interested in the *${jobTitle}* position at *${companyName}*.

*My Details:*
- Name: ${profile.full_name || 'Not provided'}
- Current Position: ${profile.current_position || 'Not specified'}
- Experience: ${profile.experience_years || 0} years
- Phone: ${profile.phone || profile.whatsapp_number || 'Not provided'}
- Email: ${user.email || 'Not provided'}
- Location: ${profile.city || profile.state || profile.location || 'Not specified'}

I would like to discuss this opportunity further.

Thank you!`;
    } else {
      return `Hello,

I am interested in the *${jobTitle}* position at *${companyName}*.

*My Details:*
- Name: [Your Name]
- Current Position: [Your Position]
- Experience: [Your Experience] years
- Phone: [Your Phone]
- Email: [Your Email]

I would like to discuss this opportunity further.

Thank you!`;
    }
  };

  // Generate Email subject and body
  const generateEmailContent = () => {
    const jobTitle = jobData?.title || 'Job Position';
    const companyName = jobData?.api_company_name || jobData?.company?.company_name || 'Company';
    
    const subject = `Application for ${jobTitle} Position`;
    
    if (user && profile) {
      const body = `Dear Hiring Manager,

I am writing to express my interest in the ${jobTitle} position at ${companyName}.

My Details:
- Name: ${profile.full_name || 'Not provided'}
- Current Position: ${profile.current_position || 'Not specified'}
- Experience: ${profile.experience_years || 0} years
- Phone: ${profile.phone || profile.whatsapp_number || 'Not provided'}
- Email: ${user.email || 'Not provided'}
- Location: ${profile.city || profile.state || profile.location || 'Not specified'}
- Skills: ${profile.skills?.join(', ') || 'Not specified'}

I would welcome the opportunity to discuss how my experience aligns with your requirements.

Thank you for your consideration.

Best regards,
${profile.full_name || 'Applicant'}`;
      
      return { subject, body };
    } else {
      const body = `Dear Hiring Manager,

I am writing to express my interest in the ${jobTitle} position at ${companyName}.

My Details:
- Name: [Your Name]
- Current Position: [Your Position]
- Experience: [Your Experience] years
- Phone: [Your Phone]
- Email: [Your Email]
- Location: [Your Location]

I would welcome the opportunity to discuss how my experience aligns with your requirements.

Thank you for your consideration.

Best regards,
[Your Name]`;
      
      return { subject, body };
    }
  };
  const { location: userLocation } = useUserLocation();

  // Calculate distance using saved profile location and job coordinates
  const distance = useMemo(() => {
    if (!userLocation.latitude || !userLocation.longitude) {
      return null;
    }
    // Use job's own coordinates if available, fallback to company coordinates
    const jobLat = (jobData as any)?.latitude || jobData?.company?.latitude;
    const jobLng = (jobData as any)?.longitude || jobData?.company?.longitude;
    
    if (!jobLat || !jobLng) {
      return null;
    }
    return calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      Number(jobLat),
      Number(jobLng)
    );
  }, [userLocation.latitude, userLocation.longitude, jobData]);

  const fetchJobData = async () => {
    if (!id) {
      console.error('❌ [JobDetail] No job ID provided');
      toast.error("Invalid job link", {
        description: "Please try accessing the job from our jobs page"
      });
      navigate('/jobs');
      return;
    }

    console.log('🔍 [JobDetail] Fetching job with ID:', id);
    console.log('🔍 [JobDetail] User:', user ? 'Authenticated' : 'Anonymous');
    console.log('🔍 [JobDetail] Referrer:', document.referrer || 'Direct/Unknown');

    try {
      // Log the exact query being executed
      console.log('🔍 [JobDetail] Executing query...');
      
      const jobSelect = `
        *,
        company:companies(
          *,
          is_verified,
          verified_plan_end,
          badge_color,
          instagram_link,
          facebook_link,
          youtube_link,
          linkedin_link
        )
      `;
      
      let jobData: any = null;
      let error: any = null;

      // Check if ID is a valid UUID - only query by UUID if it is
      if (isUuid(id)) {
        console.log('🔍 [JobDetail] ID is UUID, querying by id:', id);
        const { data, error: uuidError } = await supabase
          .from('jobs')
          .select(jobSelect)
          .eq('id', id)
          .eq('status', 'active')
          .maybeSingle();
        
        jobData = data;
        error = uuidError;
      } else {
        console.log('🔍 [JobDetail] ID is not UUID, trying public_slug first:', id);
        // Not a UUID - try public_slug first
        const { data: jobBySlug, error: slugError } = await supabase
          .from('jobs')
          .select(jobSelect)
          .eq('public_slug', id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (jobBySlug) {
          console.log('✅ [JobDetail] Found job by public_slug:', jobBySlug.id);
          jobData = jobBySlug;
        } else if (!slugError) {
          // Try by short_id if slug didn't match
          console.log('🔍 [JobDetail] Slug lookup failed, trying short_id lookup for:', id);
          const { data: jobByShortId, error: shortIdError } = await supabase
            .from('jobs')
            .select(jobSelect)
            .eq('short_id', id)
            .eq('status', 'active')
            .maybeSingle();
          
          if (jobByShortId) {
            console.log('✅ [JobDetail] Found job by short_id:', jobByShortId.id);
            jobData = jobByShortId;
          }
          if (shortIdError) {
            error = shortIdError;
          }
        } else {
          error = slugError;
        }
      }

      console.log('📊 [JobDetail] Query result:', {
        hasData: !!jobData,
        hasError: !!error,
        jobId: jobData?.id,
        jobTitle: jobData?.title,
        jobStatus: jobData?.status,
        hasCompany: !!jobData?.company,
        companyName: jobData?.company?.company_name,
        error: error
      });

      if (error) {
        console.error('❌ [JobDetail] Supabase error:', error);
        toast.error("Failed to load job details");
        navigate('/jobs');
        return;
      }

      if (!jobData) {
        console.error('❌ [JobDetail] Job not found for ID:', id);
        console.log('🔍 [JobDetail] Checking if job exists in database...');
        
        // Additional check without status filter to see if job exists at all
        let jobCheck: any = null;
        if (isUuid(id)) {
          const { data } = await supabase
            .from('jobs')
            .select('id, status, visibility, company_id, title')
            .eq('id', id)
            .maybeSingle();
          jobCheck = data;
        } else {
          // Check by public_slug or short_id
          const { data: slugCheck } = await supabase
            .from('jobs')
            .select('id, status, visibility, company_id, title')
            .eq('public_slug', id)
            .maybeSingle();
          
          if (slugCheck) {
            jobCheck = slugCheck;
          } else {
            const { data: shortIdCheck } = await supabase
              .from('jobs')
              .select('id, status, visibility, company_id, title')
              .eq('short_id', id)
              .maybeSingle();
            jobCheck = shortIdCheck;
          }
        }
        
        console.log('🔍 [JobDetail] Job existence check:', jobCheck);
        
        // Better error message for external traffic (WhatsApp, Telegram, etc.)
        if (jobCheck) {
          if (jobCheck.status === 'expired') {
            toast.error("This job posting has expired", {
              description: "Browse our latest active job openings instead"
            });
          } else if (jobCheck.status === 'closed') {
            toast.error("This job is no longer accepting applications", {
              description: "The position has been filled or closed"
            });
          } else {
            toast.error("This job is currently unavailable", {
              description: "It may have been removed or is pending review"
            });
          }
        } else {
          toast.error("Job not found", {
            description: "The job link may be invalid or the posting has been removed"
          });
        }
        
        navigate('/jobs');
        return;
      }

      console.log('✅ [JobDetail] Job loaded successfully:', jobData.title);
      setJobData(jobData);
    } catch (error) {
      console.error('❌ [JobDetail] Exception:', error);
      toast.error("Failed to load job details");
      navigate('/jobs');
    }
  };

  useEffect(() => {
    if (id) {
      fetchJobData();
    }
  }, [id, navigate]);

  // Fetch job images when job data is loaded
  useEffect(() => {
    const fetchJobImages = async () => {
      if (!jobData?.id) return;
      
      try {
        const { data: images, error } = await supabase
          .from('job_images')
          .select('*')
          .eq('job_id', jobData.id)
          .order('sort_order', { ascending: true });
        
        if (error) {
          console.error('Error fetching job images:', error);
          return;
        }
        
        if (images && images.length > 0) {
          setJobImages(images as JobImage[]);
        }
      } catch (error) {
        console.error('Error fetching job images:', error);
      }
    };
    
    fetchJobImages();
  }, [jobData?.id]);

  // Track job view when job data is loaded
  useEffect(() => {
    if (jobData && id) {
      trackJobView(id, {
        category: jobData.category,
        location: jobData.location,
        salaryRange: jobData.salary_range,
        jobType: jobData.job_type
      });
    }
  }, [jobData?.id, id, trackJobView]);

  // Countdown effect for external redirect
  useEffect(() => {
    if (showRedirectModal && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showRedirectModal && redirectCountdown === 0 && jobData?.external_apply_url) {
      // Auto redirect after countdown
      window.open(jobData.external_apply_url, '_blank');
      setShowRedirectModal(false);
    }
  }, [showRedirectModal, redirectCountdown, jobData?.external_apply_url]);

  const redirectToExternalApply = (url: string) => {
    // Same-tab navigation is the most reliable on mobile (avoids popup blockers).
    window.location.href = url;
  };

  // Helper function to get postal code for city/state
  const getPostalCodeForCity = (cityName: string, stateName: string): string => {
    const cityPostalMap: Record<string, string> = {
      'delhi': '110001',
      'new delhi': '110001',
      'mumbai': '400001',
      'bangalore': '560001',
      'bengaluru': '560001',
      'hyderabad': '500001',
      'chennai': '600001',
      'kolkata': '700001',
      'pune': '411001',
      'ahmedabad': '380001',
      'jaipur': '302001',
      'lucknow': '226001',
      'noida': '201301',
      'gurgaon': '122001',
      'gurugram': '122001',
      'chandigarh': '160001',
      'indore': '452001',
      'bhopal': '462001',
      'nagpur': '440001',
      'coimbatore': '641001',
      'kochi': '682001',
      'thiruvananthapuram': '695001',
      'visakhapatnam': '530001',
      'surat': '395001',
      'vadodara': '390001',
      'rajkot': '360001',
      'patan': '384265',
      'shankheswar': '384240',
      'mehsana': '384001',
      // State-level fallbacks
      'gujarat': '380001',
      'maharashtra': '400001',
      'karnataka': '560001',
      'tamil nadu': '600001',
      'telangana': '500001',
      'andhra pradesh': '520001',
      'west bengal': '700001',
      'uttar pradesh': '226001',
      'rajasthan': '302001',
      'madhya pradesh': '462001',
      'kerala': '682001',
      'punjab': '160001',
      'haryana': '122001',
    };
    
    const cityKey = cityName.toLowerCase().trim();
    const stateKey = stateName.toLowerCase().trim();
    
    return cityPostalMap[cityKey] || cityPostalMap[stateKey] || '110001';
  };

  const generateJobStructuredData = () => {
    if (!jobData) return {};

    const todayIso = new Date().toISOString();

    // Parse location data with proper fallbacks
    const locationParts = jobData.location?.split(',') || [];
    const city = (jobData.city || locationParts[0]?.trim() || 'Remote').trim();
    const state = (jobData.state || locationParts[1]?.trim() || 'India').trim();

    const locationText = (jobData.location || '').toLowerCase();
    const isRemote =
      locationText.includes('remote') ||
      locationText.includes('Workly India') ||
      locationText.includes('Workly India') ||
      (jobData.location || '').toLowerCase() === 'remote';

    // Map job type to Google's employment types
    const employmentTypeMap: Record<string, string> = {
      'full_time': 'FULL_TIME',
      'full-time': 'FULL_TIME',
      'fulltime': 'FULL_TIME',
      'part_time': 'PART_TIME',
      'part-time': 'PART_TIME',
      'parttime': 'PART_TIME',
      'contract': 'CONTRACTOR',
      'freelance': 'CONTRACTOR',
      'internship': 'INTERN',
      'intern': 'INTERN',
      'temporary': 'TEMPORARY',
    };

    const employmentType = employmentTypeMap[jobData.job_type?.toLowerCase()] || 'FULL_TIME';

    // Get postal code for the location
    const postalCode = getPostalCodeForCity(city, state);

    // Get primary job image for schema
    const primaryJobImage = jobImages[0]?.image_url;
    const companyLogo = jobData.company?.logo_url || `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`;

    // Build schema
    const schema: any = {
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      "title": jobData.title,
      "description": `${jobData.description}${jobData.requirements ? `\n\nRequirements:\n${jobData.requirements}` : ''}`,
      "identifier": {
        "@type": "PropertyValue",
        "name": "Workly India",
        "value": id || jobData.id,
      },
      "datePosted": jobData.created_at ? new Date(jobData.created_at).toISOString() : todayIso,
      "validThrough": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      "employmentType": employmentType,
      // Add images for Google Jobs rich results
      "image": primaryJobImage ? [
        primaryJobImage,
        companyLogo
      ] : [companyLogo],
      "hiringOrganization": {
        "@type": "Organization",
        "name": jobData.company?.company_name || jobData.company_name || 'Workly India',
        "sameAs": CANONICAL_URL,
        "logo": companyLogo,
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          ...(isRemote ? {} : (jobData.precise_address ? { "streetAddress": jobData.precise_address } : {})),
          "addressLocality": city,
          "addressRegion": state,
          "postalCode": postalCode,
          "addressCountry": "IN",
        },
      },
      "directApply": true,
      "url": `${CANONICAL_URL}/job/${jobData.public_slug || id}`,
    };

    // Workly India hints
    if (isRemote) {
      schema.jobLocationType = "TELECOMMUTE";
      schema.applicantLocationRequirements = {
        "@type": "Country",
        "name": "India",
      };
    }

    // Salary (only include if we actually have numeric values)
    if (typeof jobData.salary_min === 'number' || typeof jobData.salary_max === 'number') {
      const minSalary = jobData.salary_min ?? jobData.salary_max ?? undefined;
      const maxSalary = jobData.salary_max ?? jobData.salary_min ?? undefined;

      if (typeof minSalary === 'number' && typeof maxSalary === 'number') {
        schema.baseSalary = {
          "@type": "MonetaryAmount",
          "currency": jobData.salary_currency || "INR",
          "value": {
            "@type": "QuantitativeValue",
            "value": Math.round((minSalary + maxSalary) / 2),
            "minValue": minSalary,
            "maxValue": maxSalary,
            "unitText": (jobData.salary_period || 'MONTH').toUpperCase(),
          },
        };
      }
    }

    // Experience requirements - ONLY add if years > 0 (skip for freshers)
    const exp = (jobData.experience_level || '').toString().trim().toLowerCase();
    const yearsMatch = exp.match(/(\d+)\s*[-–]\s*(\d+)/) || exp.match(/(\d+)\s*\+?/);
    const years = yearsMatch ? Number(yearsMatch[1]) : (exp.includes('fresher') ? 0 : NaN);
    
    // Only add experienceRequirements if years > 0 (fixes "must be positive" warning)
    if (!Number.isNaN(years) && years > 0) {
      schema.experienceRequirements = {
        "@type": "OccupationalExperienceRequirements",
        "monthsOfExperience": Math.max(1, Math.round(years * 12)),
      };
    }

    // Optional fields
    if (jobData.requirements) schema.qualifications = jobData.requirements;
    if (jobData.company?.industry || jobData.category) schema.industry = jobData.company?.industry || jobData.category;
    if (jobData.benefits) schema.jobBenefits = jobData.benefits;

    return schema;
  };


  if (!jobData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading job details...</h2>
          <p className="text-muted-foreground">Please wait while we fetch the job information.</p>
        </div>
      </div>
    );
  }

  const displayJobId = jobData.short_id || id || jobData.id;

  const copyJobId = async () => {
    try {
      await navigator.clipboard.writeText(displayJobId);
      toast.success("Job ID copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy Job ID");
    }
  };

  // Send confirmation email to applicant when employer has enabled auto_email_confirmation
  const sendApplicantConfirmationEmail = async (applicantEmail: string, applicantName: string) => {
    try {
      if (!jobData?.auto_email_confirmation || !applicantEmail) return;
      const jobTitle = jobData?.title || 'the role';
      const companyName = jobData?.company?.company_name || jobData?.company_name || 'the company';
      const appliedOn = new Date();
      const dd = String(appliedOn.getDate()).padStart(2, '0');
      const mm = appliedOn.toLocaleString('en-GB', { month: 'long' });
      const yyyy = appliedOn.getFullYear();
      const appliedOnStr = `${dd} ${mm} ${yyyy}`;
      const html = `
        <p>Hi ${applicantName || 'there'},</p>
        <p>Thank you for applying for the <strong>${jobTitle}</strong> position through <strong>Workly India</strong>.</p>
        <p>✅ Your application has been submitted successfully.</p>
        <ul>
          <li><strong>Job Title:</strong> ${jobTitle}</li>
          <li><strong>Company:</strong> ${companyName}</li>
          <li><strong>Applied On:</strong> ${appliedOnStr}</li>
        </ul>
        <p>If the employer shortlists your application, they may contact you directly.</p>
        <p>Thank you for using Workly India.</p>
      `;
      await supabase.functions.invoke('email-api/send-email', {
        body: {
          to: applicantEmail,
          toName: applicantName || applicantEmail,
          subject: 'Your application has been received – Workly India',
          htmlContent: html,
          senderName: 'Workly India'
        }
      });
    } catch (err) {
      console.error('Failed to send applicant confirmation email:', err);
    }
  };

  const handleGuestApply = async (guestInfo: { name: string; whatsapp_number: string; email: string; phone?: string; bio?: string; location?: string }) => {

    if (!id) return;
    
    setIsApplying(true);
    console.log(`[JobDetail v${BUILD_VERSION}] Guest apply started for job:`, id);
    
    try {
      // Use centralized job application service (RPC-based, bypasses cache issues)
      const result = await submitJobApplication(
        id,
        null, // Guest applications use null
        buildGuestCoverLetter(guestInfo),
        {
          fullName: guestInfo.name.trim(),
          whatsappNumber: guestInfo.whatsapp_number.trim(),
          email: guestInfo.email.trim().toLowerCase(),
          phone: guestInfo.phone?.trim() || undefined,
          bio: guestInfo.bio?.trim() || undefined,
          location: guestInfo.location?.trim() || undefined
        },
        'website'
      );

      if (!result.success) {
        console.error(`[JobDetail v${BUILD_VERSION}] Guest application failed:`, result);
        toast.error(result.error || "Failed to submit application");
        setIsApplying(false);
        return;
      }

      // Save guest info to localStorage for future applications
      localStorage.setItem('wfh_guest_applicant_info', JSON.stringify({
        name: guestInfo.name,
        whatsapp_number: guestInfo.whatsapp_number,
        email: guestInfo.email,
        phone: guestInfo.phone || '',
        bio: guestInfo.bio || '',
        location: guestInfo.location || '',
        savedAt: new Date().toISOString()
      }));

      // Track the application
      await trackJobApply(id);

      // Save to local storage for guest users (for activity page)
      try {
        const localApplication = {
          id: `local_${Date.now()}`,
          jobId: id,
          title: jobData.title,
          company: jobData.company?.company_name || jobData.company_name || 'Company',
          location: jobData.location,
          appliedDate: new Date().toISOString(),
          status: 'Under Review',
          statusColor: 'bg-yellow-600',
          salary: jobData.salary_range || 'Not specified'
        };
        
        saveApplicationToLocal(localApplication);
        console.log(`[JobDetail v${BUILD_VERSION}] Guest application saved to local storage`);
      } catch (localError) {
        console.error('Failed to save to local storage:', localError);
      }
      
      // Employer Push / Email / Telegram for guest applications are sent by the
      // database trigger on job_applications (which carries the guest's own
      // name, phone and email), so nothing extra is fired here.

      setApplicationSubmitted(true);
      setShowGuestDialog(false);

      // Send auto confirmation email to candidate if enabled
      sendApplicantConfirmationEmail(guestInfo.email, guestInfo.name);

      // Redirect to external site only for "both" mode
      const gMode = jobData?.apply_mode || (jobData?.external_apply_url ? 'both' : 'workly');
      if (gMode === 'both' && jobData?.external_apply_url) {
        toast.success("Application submitted! Redirecting to company website...");
        setTimeout(() => redirectToExternalApply(jobData.external_apply_url!), 300);
      } else {
        toast.success("Application submitted successfully!");
      }

    } catch (error) {
      console.error(`[JobDetail v${BUILD_VERSION}] Error submitting guest application:`, error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyJob = async () => {
    if (!id) return;

    // If employer chose "External Website only", skip Workly application and redirect
    const mode = jobData?.apply_mode || (jobData?.external_apply_url ? 'both' : 'workly');
    if (mode === 'external' && jobData?.external_apply_url) {
      try { await trackJobApply(id); } catch {}
      window.open(jobData.external_apply_url, '_blank', 'noopener,noreferrer');
      toast.success("Redirecting you to the company website to apply...");
      return;
    }


    // Check if user is logged in
    if (!user) {
      // The guest dialog prefills saved details and runs the security check (Turnstile) before applying.
      setShowGuestDialog(true);
      return;
    }

    setIsApplying(true);
    console.log(`[JobDetail v${BUILD_VERSION}] Logged-in apply started for job:`, id);
    
    try {
      // Get user's profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        toast.error("Please complete your profile first");
        navigate("/JobSeeker/Setup");
        setIsApplying(false);
        return;
      }

      // Check if profile has all required fields for applying
      const requiredFields = {
        full_name: profile.full_name,
        phone: profile.phone,
        whatsapp_number: profile.whatsapp_number,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        postal_code: profile.postal_code
      };

      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value || (typeof value === 'string' && !value.trim()))
        .map(([key]) => key.replace('_', ' '));

      if (missingFields.length > 0) {
        toast.error("Please complete your profile to apply for jobs", {
          description: `Missing: ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? '...' : ''}`
        });
        navigate("/JobSeeker/Setup");
        setIsApplying(false);
        return;
      }

      // Check account status before applying
      if (profile.account_status === 'job_banned') {
        toast.error("You are banned from applying to jobs. Please contact support for assistance.");
        setIsApplying(false);
        return;
      }

      if (profile.account_status === 'banned') {
        toast.error("Your account is banned. Please contact support for assistance.");
        setIsApplying(false);
        return;
      }

      // Use centralized job application service (RPC-based, bypasses cache issues)
      const result = await submitJobApplication(
        id,
        user.id,
        buildProfileCoverLetter(profile),
        undefined,
        'website'
      );
      
      // Get employer ID for later use in notifications
      const employerId = jobData?.company?.user_id;

      if (!result.success) {
        console.error(`[JobDetail v${BUILD_VERSION}] Application failed:`, result);
        toast.error(result.error || "Failed to submit application");
        setIsApplying(false);
        return;
      }

      // Track the application
      await trackJobApply(id);
      
      // Push / Email / Telegram for BOTH sides are sent automatically by the
      // database trigger on job_applications (email-api ->
      // job_application_notification), which uses the real applicant details.
      // Only WhatsApp is sent here, because the hub does not cover it.
      try {
        const companyName = jobData?.company?.company_name || jobData?.company_name || 'Company';
        const jobTitle = jobData?.title || 'Job';

        // WhatsApp to applicant
        const applicantPhone = profile.whatsapp_number || profile.phone;
        if (applicantPhone) {
          await triggerWhatsAppEvent('application_submitted', applicantPhone, profile.full_name || 'User', {
            job_title: jobTitle,
            company_name: companyName
          });
        }

        // WhatsApp to employer
        const { data: employerCompany } = await supabase
          .from('companies')
          .select('whatsapp_number, phone, company_name')
          .eq('user_id', employerId)
          .maybeSingle();

        const employerPhone = employerCompany?.whatsapp_number || employerCompany?.phone;
        if (employerPhone) {
          await triggerWhatsAppEvent('new_application_received', employerPhone, employerCompany?.company_name || 'Employer', {
            applicant_name: profile.full_name || 'Candidate',
            job_title: jobTitle,
            company_name: companyName
          });
        }
      } catch (notificationError) {
        console.error('Failed to send notifications:', notificationError);
      }
      
      // Update local state to show applied status without page reload
      setApplicationSubmitted(true);

      // Send auto confirmation email to candidate if enabled
      sendApplicantConfirmationEmail(profile.email || user.email || '', profile.full_name || 'Candidate');

      // Redirect to external site only for "both" mode
      const lMode = jobData?.apply_mode || (jobData?.external_apply_url ? 'both' : 'workly');
      if (lMode === 'both' && jobData?.external_apply_url) {
        toast.success("Application submitted! Redirecting to company website...");
        setTimeout(() => redirectToExternalApply(jobData.external_apply_url!), 300);
      } else {
        toast.success("Application submitted successfully! Employer will contact you soon.");
        // Show share dialog after successful application
        setTimeout(() => setShowShareDialog(true), 1000);
      }

      
    } catch (error) {
      console.error(`[JobDetail v${BUILD_VERSION}] Error submitting application:`, error);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleCallEmployer = async () => {
    if (id) {
      await trackJobCall(id);
    }
    // Prefer API contact details over company contact details
    const phoneNumber = jobData?.api_phone || jobData?.company?.phone || jobData?.api_whatsapp_number || jobData?.company?.whatsapp_number;
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, '_self');
    } else {
      toast.error("Contact information not available");
    }
  };

  const handleShareJob = async () => {
    if (id) {
      await trackJobShare(id);
    }
  };

  const jobId = id || jobData.id;
  
  // Check if user has already applied for this job - use string comparison to be safe
  const hasApplied = applicationSubmitted || applications.some(app => app.jobId === jobId || app.jobId === id || app.jobId === jobData.id);

  // Apply mode + deadline handling
  const applyMode = jobData.apply_mode || (jobData.external_apply_url ? 'both' : 'workly');
  const deadlineDate = jobData.application_deadline ? new Date(jobData.application_deadline) : null;
  const deadlinePassed = !!deadlineDate && deadlineDate.getTime() < Date.now();
  const deadlineDisplay = deadlineDate
    ? `${String(deadlineDate.getDate()).padStart(2, '0')}/${String(deadlineDate.getMonth() + 1).padStart(2, '0')}/${deadlineDate.getFullYear()}`
    : null;


  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'hsl(var(--background) / 0.85)' }}>
      <AnimatedJobBackground />
      <Helmet>
        <title>{`${jobData.title} at ${jobData.company?.company_name || jobData.company_name} - Workly India Jobs`}</title>
        <meta name="description" content={`${jobData.title} position at ${jobData.company?.company_name || jobData.company_name} in ${jobData.location}. Salary: ${jobData.salary_range}. Apply now for this ${jobData.job_type} remote job opportunity.`} />
        <meta name="keywords" content={`${jobData.title}, Workly India, remote job, ${jobData.company?.company_name || jobData.company_name}, ${jobData.location}, online job, ${jobData.skills?.join(', ') || ''}`} />
        <link rel="canonical" href={`${CANONICAL_URL}/job/${jobData.public_slug || id}`} />
        
        {/* Open Graph Meta Tags for Social Sharing */}
        <meta property="og:title" content={`${jobData.title} at ${jobData.company?.company_name || jobData.company_name} - Workly India`} />
        <meta property="og:description" content={`${jobData.description.substring(0, 160)}...`} />
        <meta property="og:url" content={`${CANONICAL_URL}/job/${jobData.public_slug || id}`} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Workly India - Remote Jobs" />
        
        {/* Job Image for Google & Social Sharing */}
        <meta property="og:image" content={jobImages[0]?.image_url || jobData.company?.logo_url || `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`} />
        <meta property="og:image:alt" content={`${jobData.title} at ${jobData.company?.company_name || jobData.company_name} - Remote Job India`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${jobData.title} at ${jobData.company?.company_name || jobData.company_name}`} />
        <meta name="twitter:description" content={`${jobData.description.substring(0, 160)}...`} />
        <meta name="twitter:image" content={jobImages[0]?.image_url || jobData.company?.logo_url || `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`} />
        <meta name="twitter:image:alt" content={`${jobData.title} - Remote Job Opportunity`} />
        
        {/* Article Meta for better indexing */}
        <meta property="article:published_time" content={jobData.created_at} />
        <meta property="article:author" content={jobData.company?.company_name || jobData.company_name || 'Workly India'} />
        <meta property="article:section" content="Jobs" />
        <meta property="article:tag" content="Workly India" />
        <meta property="article:tag" content="remote job" />
        <meta property="article:tag" content={jobData.category || 'job opportunity'} />
        
        <script type="application/ld+json">
          {JSON.stringify(generateJobStructuredData())}
        </script>
      </Helmet>
      
      <div className="container mx-auto px-4 py-4 pb-24 max-w-4xl animate-fade-in scroll-smooth relative z-10">
        {/* Header with Back Button, Job ID and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/jobs')}
              className="p-3 hover:bg-accent active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="underline">Back</span>
            </Button>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Job ID: {displayJobId}</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={copyJobId}
                className="h-auto p-1 hover:bg-muted"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Like and Share Icons */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`hover:bg-red-50 transition-colors ${
                isFavorited(jobId) 
                  ? 'text-red-500 hover:text-red-600' 
                  : 'hover:text-red-500'
              }`}
              onClick={() => toggleFavorite(jobId)}
            >
              <Heart className={`w-5 h-5 ${isFavorited(jobId) ? 'fill-current' : ''}`} />
            </Button>
            <ShareDialog 
              jobTitle={jobData.title}
              company={jobData.company?.company_name || jobData.company_name}
              jobId={jobData.id}
              shortId={jobData.short_id}
              publicSlug={jobData.public_slug}
              salary_min={jobData.salary_min}
              salary_max={jobData.salary_max}
              salary_currency={jobData.salary_currency}
              salary_period={jobData.salary_period}
              city={jobData.city}
              state={jobData.state}
              location={jobData.location}
              job_type={jobData.job_type}
              experience_level={jobData.experience_level}
              category={jobData.category}
              onShare={handleShareJob}
            />
          </div>
        </div>

        {/* Job Title, Company, Location & Salary */}
        <div className="mb-4 bg-white rounded-2xl border border-border shadow-lg p-5">
          <h1 className="text-base font-bold text-foreground break-words hyphens-auto leading-snug">
            {jobData.title}
          </h1>

          {/* Company Logo, Name & Posted Date */}
          <div className="flex items-start gap-3 mt-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-primary flex items-center justify-center shrink-0 border border-border/50">
              <CompanyLogo
                src={jobData.company?.logo_url}
                alt={jobData.api_company_name || jobData.company?.company_name || 'Company'}
                size={112}
                iconClassName="w-7 h-7 text-white"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                {jobData.api_company_name || jobData.company?.company_name || jobData.company_name}
                {!jobData.api_company_name && jobData.company?.is_verified && (!jobData.company?.verified_plan_end || new Date(jobData.company.verified_plan_end) > new Date()) && (
                  <VerificationBadge
                    color={jobData.company.badge_color as 'gold' | 'blue' | 'green' | 'silver' || 'gold'}
                    size={14}
                  />
                )}
              </span>
              {(() => {
                if (!jobData.created_at) return null;
                const d = new Date(jobData.created_at);
                if (isNaN(d.getTime())) return null;
                const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
                const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const gp = (jobData as any).gender_preference;
                const genderLabel = gp === 'male' ? 'Male Only' : gp === 'female' ? 'Female Only' : 'Male & Female';
                return (
                  <>
                    <span className="text-muted-foreground text-xs mt-0.5">Posted on {day} • {time}</span>
                    <span className="text-muted-foreground text-xs mt-0.5">{genderLabel}</span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Location - plain text */}
          <div className="flex items-center gap-2 text-muted-foreground mt-2.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="text-sm">{jobData.precise_address || jobData.location}</span>
          </div>

          {/* Experience + Vacancies, Job Type */}
          <div className="mt-2 space-y-1">
            <div className="flex items-center space-x-2 text-muted-foreground text-sm">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{jobData.experience_level} Year Experience</span>
              {typeof jobData.openings === 'number' && jobData.openings > 0 && (
                <span className="flex items-center gap-1">
                  <span>-</span>
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>{jobData.openings} {jobData.openings > 1 ? 'Vacancies' : 'Vacancy'}</span>
                </span>
              )}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5 mr-2" />
              <span className="font-medium">{jobData.job_type}</span>
              {jobData.department && (
                <>
                  <span className="mx-2">•</span>
                  <span className="font-medium">{jobData.department}</span>
                </>
              )}
            </div>
            {(jobData as any).gender_preference && (jobData as any).gender_preference !== 'both' && (
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5 mr-2" />
                <span className="font-medium">
                  {(jobData as any).gender_preference === 'male' ? 'Male Only' : 'Female Only'}
                </span>
              </div>
            )}
          </div>

          {/* Salary - plain text like JobCard */}
          {(() => {
            const raw = jobData.salary_min && jobData.salary_max
              ? `${jobData.salary_currency || '₹'} ${jobData.salary_min.toLocaleString()} - ${jobData.salary_max.toLocaleString()} / ${jobData.salary_period || 'year'}`
              : (jobData.salary_range || '').trim();
            if (!raw || /not\s*disclosed|not\s*specified/i.test(raw)) {
              return (
                <div className="mt-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium text-muted-foreground text-sm">Salary: As per company standards</span>
                </div>
              );
            }
            return (
              <div className="mt-2 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-success shrink-0" />
                <span className="font-semibold text-success text-sm">{formatSalaryWithPeriod(raw)}</span>
              </div>
            );
          })()}
        </div>

        {/* Job Images Gallery */}
        {jobImages.length > 0 && (
          <div className="mb-4">
            <JobImageGallery 
              images={jobImages} 
              jobTitle={jobData.title}
              companyName={jobData.company_name}
            />
          </div>
        )}

        {/* Job Highlights */}
        {(jobData.skills?.length || jobData.category || jobData.department) && (
          <Card className="p-4 mb-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-l-orange-400">
            <div className="flex items-center mb-3">
              <span className="text-lg">⚡</span>
              <h2 className="text-lg font-semibold text-orange-800 ml-2">Job Highlights</h2>
            </div>
            
            <div className="space-y-3">
              {jobData.skills?.length && (
                <div>
                  <span className="font-medium text-foreground">Skills Required: </span>
                  <span className="text-muted-foreground">{jobData.skills.slice(0, 4).join(', ')}</span>
                  {jobData.skills.length > 4 && (
                    <span className="text-muted-foreground">...</span>
                  )}
                </div>
              )}
              
              {jobData.category && (
                <div>
                  <span className="font-medium text-foreground">Category: </span>
                  <span className="text-muted-foreground">{jobData.category}</span>
                </div>
              )}
              
              {jobData.department && (
                <div>
                  <span className="font-medium text-foreground">Department: </span>
                  <span className="text-muted-foreground">{jobData.department}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Additional Job Info */}
        {(jobData.openings || deadlineDisplay || jobData.work_mode || jobData.education_required || jobData.shift_timing || jobData.hiring_urgency || jobData.immediate_joining || jobData.resume_required || jobData.cover_letter_required) && (
          <Card className="p-4 mb-4 shadow-lg">
            <div className="flex items-center mb-3">
              <span className="text-lg">📋</span>
              <h2 className="text-lg font-semibold ml-2">Job Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {jobData.openings ? (
                <div>
                  <p className="text-muted-foreground text-xs">Vacancies</p>
                  <p className="font-medium">{jobData.openings}</p>
                </div>
              ) : null}
              {deadlineDisplay && (
                <div>
                  <p className="text-muted-foreground text-xs">Application Deadline</p>
                  <p className={`font-medium ${deadlinePassed ? 'text-destructive' : ''}`}>
                    {deadlineDisplay}{deadlinePassed ? ' (Closed)' : ''}
                  </p>
                </div>
              )}
              {jobData.work_mode && (
                <div>
                  <p className="text-muted-foreground text-xs">Work Mode</p>
                  <p className="font-medium capitalize">{jobData.work_mode}</p>
                </div>
              )}
              {jobData.education_required && jobData.education_required !== 'any' && (
                <div>
                  <p className="text-muted-foreground text-xs">Education</p>
                  <p className="font-medium capitalize">{jobData.education_required.replace('-', ' ')}</p>
                </div>
              )}
              {jobData.shift_timing && (
                <div>
                  <p className="text-muted-foreground text-xs">Shift Timing</p>
                  <p className="font-medium capitalize">{jobData.shift_timing}</p>
                </div>
              )}
              {jobData.hiring_urgency && (
                <div>
                  <p className="text-muted-foreground text-xs">Hiring Urgency</p>
                  <p className={`font-medium capitalize ${jobData.hiring_urgency === 'urgent' ? 'text-orange-600' : ''}`}>
                    {jobData.hiring_urgency}
                  </p>
                </div>
              )}
            </div>
            {jobData.immediate_joining && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3 flex gap-3">
                <span className="text-xl leading-none">⚡</span>
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">Immediate Joining</p>
                  <p className="text-sm text-green-800/80 dark:text-green-300/80">
                    The selected candidate should be able to join without delay.
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 mt-3">
              {jobData.resume_required && (
                <Badge variant="outline" className="w-full justify-center py-2 bg-green-50 border-green-500 text-green-700 dark:bg-green-950/30 dark:text-green-400 text-sm font-medium">
                  📄 Resume Required
                </Badge>
              )}
              {jobData.cover_letter_required && (
                <Badge variant="outline" className="w-full justify-center py-2 bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 text-sm font-medium">
                  ✍️ Cover Letter Required
                </Badge>
              )}
            </div>
          </Card>
        )}

        {/* Job Description */}



        <Card className="p-4 mb-4 shadow-lg">
          <div className="flex items-center mb-3">
            <span className="text-lg">📄</span>
            <h2 className="text-lg font-semibold ml-2">Job Description</h2>
          </div>
          <div className="text-muted-foreground leading-relaxed prose prose-sm max-w-none rich-text-content">
            {jobData.description.length > 300 ? (
              showFullDescription ? (
                <div>
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(jobData.description) }} />
                  <Button
                    variant="link"
                    className="p-0 h-auto text-primary mt-2"
                    onClick={() => setShowFullDescription(false)}
                  >
                    See Less <ChevronUp className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <div>
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(jobData.description.substring(0, 300) + '...') }} />
                  <Button
                    variant="link"
                    className="p-0 h-auto text-primary mt-2"
                    onClick={() => setShowFullDescription(true)}
                  >
                    See More <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )
            ) : (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(jobData.description) }} />
            )}
          </div>
        </Card>

        {/* Candidate Requirements */}
        {(jobData.requirements || jobData.skills?.length || jobData.languages?.length) && (
          <Card className="p-4 mb-4">
            <div className="flex items-center mb-3">
              <User className="w-5 h-5 text-primary mr-2" />
              <h2 className="text-lg font-semibold">Candidate Requirements</h2>
            </div>
            
            {(() => {
              const requirementsContent = (
                <div className="space-y-4">
                  {jobData.requirements && (
                    <div>
                      <h3 className="font-medium text-primary mb-1">Requirements:</h3>
                      <div className="text-muted-foreground prose prose-sm max-w-none rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(jobData.requirements) }} />
                    </div>
                  )}
                  {jobData.skills?.length && (
                    <div>
                      <h3 className="font-medium text-primary mb-2">Skills required:</h3>
                      <div className="flex flex-wrap gap-2">
                        {jobData.skills.map((skill) => (
                          <Badge key={skill} variant="secondary">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {jobData.languages?.length && (
                    <div>
                      <h3 className="font-medium text-primary mb-2">Required Languages:</h3>
                      <div className="flex flex-wrap gap-2">
                        {jobData.languages.map((language, index) => (
                          <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 capitalize">
                            {language}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {jobData.experience_level && (
                    <div>
                      <h3 className="font-medium text-primary mb-1">Experience:</h3>
                      <p className="text-muted-foreground">{formatExperienceLevel(jobData.experience_level)}</p>
                    </div>
                  )}
                </div>
              );
              const reqText = (jobData.requirements || '') + (jobData.skills?.join(' ') || '');
              const isLong = reqText.length > 200;
              return isLong ? (
                <div>
                  <div className={showFullRequirements ? '' : 'max-h-[150px] overflow-hidden relative'}>
                    {requirementsContent}
                    {!showFullRequirements && (
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
                    )}
                  </div>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-primary mt-2"
                    onClick={() => setShowFullRequirements(!showFullRequirements)}
                  >
                    {showFullRequirements ? <>See Less <ChevronUp className="w-4 h-4 ml-1" /></> : <>See More <ChevronDown className="w-4 h-4 ml-1" /></>}
                  </Button>
                </div>
              ) : requirementsContent;
            })()}
          </Card>
        )}

        {/* Benefits */}
        {jobData.benefits && (
          <Card className="p-4 mb-4">
            <div className="flex items-center mb-3">
              <span className="text-lg">💝</span>
              <h2 className="text-lg font-semibold ml-2">Benefits & Perks</h2>
            </div>
            
            {jobData.benefits.length > 200 ? (
              <div>
                <div className={showFullBenefits ? '' : 'max-h-[150px] overflow-hidden relative'}>
                  <div className="text-muted-foreground prose prose-sm max-w-none rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(jobData.benefits) }} />
                  {!showFullBenefits && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
                  )}
                </div>
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary mt-2"
                  onClick={() => setShowFullBenefits(!showFullBenefits)}
                >
                  {showFullBenefits ? <>See Less <ChevronUp className="w-4 h-4 ml-1" /></> : <>See More <ChevronDown className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground prose prose-sm max-w-none rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(jobData.benefits) }} />
            )}
          </Card>
        )}

        {/* Job Videos */}
        <VideoDisplay 
          videos={[
            ...(jobData.video_url_1 ? [{ title: jobData.video_title_1 || undefined, url: jobData.video_url_1 }] : []),
            ...(jobData.video_url_2 ? [{ title: jobData.video_title_2 || undefined, url: jobData.video_url_2 }] : [])
          ]}
        />

        {/* Company Details */}
        {jobData.company && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center">
                  <Building className="w-5 h-5 text-primary mr-2" />
                  <h2 className="text-lg font-semibold">Company Details</h2>
                </div>
                
                {/* Show Employee ID only for API posted jobs */}
                {jobData.api_company_name && jobData.company_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Employee ID:</span>
                    <code className="bg-secondary px-2 py-0.5 rounded text-xs font-mono">
                      {jobData.company_id.substring(0, 8)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(jobData.company_id!);
                        toast.success("Employee ID copied to clipboard!");
                      }}
                      title="Copy full Employee ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              
              {!jobData.api_company_name && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(jobData.company?.id ? `/company/${jobData.company.id}` : '/company-directory')}
                  className="text-primary border-primary hover:bg-primary hover:text-white"
                >
                  View Profile
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-primary mb-1">Company:</h3>
                <div className="flex items-center space-x-2">
                  <p className="text-muted-foreground">{jobData.api_company_name || jobData.company.company_name}</p>
                   {!jobData.api_company_name && jobData.company.is_verified && (!jobData.company.verified_plan_end || new Date(jobData.company.verified_plan_end) > new Date()) && (
                     <VerificationBadge 
                       color={jobData.company.badge_color as 'gold' | 'blue' | 'green' | 'silver' || 'gold'}
                       size={16}
                     />
                   )}
                </div>
              </div>
              
              {(jobData.api_industry || jobData.company.industry) && (
                <div>
                  <h3 className="font-medium text-primary mb-1">Industry:</h3>
                  <p className="text-muted-foreground capitalize">{jobData.api_industry || jobData.company.industry}</p>
                </div>
              )}
              
              {(jobData.api_organisation_size || jobData.company.organisation_size) && (
                <div>
                  <h3 className="font-medium text-primary mb-1">Organization Size:</h3>
                  <p className="text-muted-foreground">{jobData.api_organisation_size || jobData.company.organisation_size}</p>
                </div>
              )}
              
              {(jobData.api_company_description || jobData.company.description) && (
                <div>
                  <h3 className="font-medium text-primary mb-1">About Company:</h3>
                  <p className="text-muted-foreground">{jobData.api_company_description || jobData.company.description}</p>
                </div>
              )}
              
              {/* Social Media Links */}
              <SocialMediaIcons
                instagram={jobData.api_instagram_link || jobData.company.instagram_link}
                facebook={jobData.api_facebook_link || jobData.company.facebook_link}
                youtube={jobData.api_youtube_link || jobData.company.youtube_link}
                linkedin={jobData.api_linkedin_link || jobData.company.linkedin_link}
                size="md"
                className="mt-3"
              />
            </div>
          </Card>
        )}

        {/* Contact Details */}
        {(jobData.api_phone || jobData.api_email || jobData.api_whatsapp_number || jobData.company?.phone || jobData.company?.email || jobData.company?.whatsapp_number) && (
          <Card className="p-4 mb-4">
            <div className="flex items-center mb-3">
              <Phone className="w-5 h-5 text-primary mr-2" />
              <h2 className="text-lg font-semibold">Contact Details</h2>
            </div>
            
            <div className="space-y-2">
              {/* Show API contact details if available, otherwise show company contact details */}
              {(jobData.api_hr_contact_name || jobData.company?.hr_contact_name) && (
                <div>
                  <span className="font-medium">HR Contact: </span>
                  <span className="text-muted-foreground">{jobData.api_hr_contact_name || jobData.company?.hr_contact_name}</span>
                </div>
              )}
              
              {(jobData.api_phone || jobData.company?.phone) && (
                <div>
                  <span className="font-medium">Phone: </span>
                  <span className="text-muted-foreground">{jobData.api_phone || jobData.company?.phone}</span>
                </div>
              )}
              
              {(jobData.api_email || jobData.company?.email) && (
                <div>
                  <span className="font-medium">Email: </span>
                  <span className="text-muted-foreground">{jobData.api_email || jobData.company?.email}</span>
                </div>
              )}
              
              {(jobData.api_whatsapp_number || jobData.company?.whatsapp_number) && (
                <div>
                  <span className="font-medium">WhatsApp: </span>
                  <span className="text-muted-foreground">{jobData.api_whatsapp_number || jobData.company?.whatsapp_number}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Bottom Action Buttons - Share, Report, Tips */}
        <div className="flex space-x-2 mb-4">
          <ShareDialog 
            jobTitle={jobData.title}
            company={jobData.company?.company_name || jobData.company_name}
            jobId={jobData.id}
            shortId={jobData.short_id}
            publicSlug={jobData.public_slug}
            salary_min={jobData.salary_min}
            salary_max={jobData.salary_max}
            salary_currency={jobData.salary_currency}
            salary_period={jobData.salary_period}
            city={jobData.city}
            state={jobData.state}
            location={jobData.location}
            job_type={jobData.job_type}
            experience_level={jobData.experience_level}
            category={jobData.category}
            onShare={handleShareJob}
          >
            <Button variant="outline" className="flex-1 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 transition-all duration-200 active:scale-95 hover:shadow-md">
              <MessageCircle className="w-4 h-4 mr-2" />
              Share
            </Button>
          </ShareDialog>
          
          <ReportJobDialog 
            jobId={displayJobId}
            jobTitle={jobData.title}
            className="flex-1"
          />
          
          <JobTipsDialog className="flex-1" />
        </div>

        <AddressMap address={jobData.precise_address || jobData.location} title="Job location" className="mb-4" />

        {/* Ad below application section - 300x250 Banner */}
        {ADS_CONFIG.enabled && ADS_CONFIG.placements.jobDetail.belowApplication && (
          <AdContainer>
            <AdsterraBanner300x250 />
          </AdContainer>
        )}
      </div>


      {/* Fixed Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="container mx-auto max-w-4xl flex items-center gap-4">
          {/* Apply Button - Green icon when external link available */}
          <Button 
            variant="outline"
            className={`flex-1 transition-all duration-200 active:scale-95 hover:shadow-lg min-h-[44px] ${
            hasApplied
                ? 'bg-green-50 border-green-500 text-green-700 cursor-not-allowed'
                : 'bg-white border-primary text-primary hover:bg-primary hover:text-white'
            }`}
          onClick={hasApplied ? undefined : handleApplyJob}
          disabled={hasApplied || isApplying}
          >
            <Briefcase className={`w-5 h-5 mr-2 ${jobData.external_apply_url ? 'text-green-600' : ''}`} />
          {isApplying ? 'Applying...' : hasApplied ? 'Applied' : 'Apply'}
          </Button>

          
          {/* Contact Icons - Phone, WhatsApp, Email */}
          <div className="flex items-center space-x-2">
            {/* Phone Icon */}
            {(jobData?.api_phone || jobData?.company?.phone) && (
              <Button 
                variant="outline" 
                size="icon" 
                className="w-11 h-11 rounded-full border-primary"
                onClick={() => window.open(`tel:${jobData?.api_phone || jobData?.company?.phone}`, '_self')}
              >
                <LottieIcon animationData={callAnimation} size={28} />
              </Button>
            )}
            
            {/* WhatsApp Icon */}
            {(jobData?.api_whatsapp_number || jobData?.company?.whatsapp_number) && (
              <Button 
                variant="outline" 
                size="icon" 
                className="w-11 h-11 rounded-full border-green-600 bg-green-500 hover:bg-green-600"
                onClick={() => {
                  const number = (jobData?.api_whatsapp_number || jobData?.company?.whatsapp_number || '').replace(/\D/g, '');
                  const message = encodeURIComponent(generateWhatsAppMessage());
                  window.open(`https://wa.me/${number}?text=${message}`, '_blank');
                }}
              >
                <LottieIcon animationData={whatsappAnimation} size={28} />
              </Button>
            )}
            
            {/* Email Icon */}
            {(jobData?.api_email || jobData?.company?.email) && (
              <Button 
                variant="outline" 
                size="icon" 
                className="w-11 h-11 rounded-full border-blue-500"
                onClick={() => {
                  const email = jobData?.api_email || jobData?.company?.email;
                  const { subject, body } = generateEmailContent();
                  window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                }}
              >
                <LottieIcon animationData={emailAnimation} size={30} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Guest Application Dialog */}
      <GuestApplicationDialog
        open={showGuestDialog}
        onClose={() => setShowGuestDialog(false)}
        onSubmit={handleGuestApply}
        isSubmitting={isApplying}
      />

      {/* External Redirect Modal */}
      {showRedirectModal && jobData?.external_apply_url && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <Card className="p-6 m-4 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <Globe className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Application Submitted! ✅</h3>
            <p className="text-muted-foreground">
              Your application has been saved. Redirecting you to the company website...
            </p>
            <div className="text-4xl font-bold text-primary">{redirectCountdown}</div>
            <p className="text-sm text-muted-foreground">seconds</p>
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowRedirectModal(false)}
              >
                Stay Here
              </Button>
              <Button 
                className="flex-1"
                onClick={() => window.open(jobData.external_apply_url!, '_blank')}
              >
                <Globe className="w-4 h-4 mr-2" />
                Go Now
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Application Success Share Dialog */}
      <ApplicationSuccessShare
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        jobTitle={jobData?.title || ''}
        companyName={jobData?.company?.company_name || jobData?.company_name || ''}
        jobId={jobData?.id || id || ''}
        shortId={jobData?.short_id}
        publicSlug={jobData?.public_slug}
      />
    </div>
  );
};

export default JobDetail;
