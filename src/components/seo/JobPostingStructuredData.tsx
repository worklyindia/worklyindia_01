import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;

interface JobPostingStructuredDataProps {
  job: {
    id: string;
    title: string;
    description: string;
    company_name?: string;
    company?: string;
    location?: string;
    city?: string;
    state?: string;
    district?: string;
    postal_code?: string;
    salary_min?: number;
    salary_max?: number;
    job_type?: string;
    created_at?: string;
    expires_at?: string;
    is_remote?: boolean;
    slug?: string;
    skills?: string[];
    experience_level?: string;
    education_required?: string;
    benefits?: string[];
    category?: string;
  };
  companyLogoUrl?: string;
  companyWebsite?: string;
  jobImageUrl?: string;
}

// City to postal code mapping for India
const getCityPostalCode = (city: string, state: string): string => {
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
  
  return cityPostalMap[city.toLowerCase().trim()] || 
         cityPostalMap[state.toLowerCase().trim()] || 
         '110001';
};

// Helper to extract location parts from location string
const parseLocation = (location?: string) => {
  if (!location) return { city: 'Remote', state: 'India', postalCode: '110001' };
  
  // Common patterns: "City, State" or "City, State, Country" or just "City"
  const parts = location.split(',').map(p => p.trim());
  const city = parts[0] || 'Remote';
  const state = parts[1] || 'India';
  
  return {
    city,
    state,
    postalCode: getCityPostalCode(city, state)
  };
};

export const JobPostingStructuredData = ({ 
  job, 
  companyLogoUrl,
  companyWebsite,
  jobImageUrl
}: JobPostingStructuredDataProps) => {
  const companyName = job.company_name || job.company || BRAND_CONFIG.name;
  
  // Map job types to Google's employment types
  const employmentTypeMap: Record<string, string | string[]> = {
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
    'temp': 'TEMPORARY',
    'volunteer': 'VOLUNTEER',
    'per_diem': 'PER_DIEM',
  };

  const employmentType = employmentTypeMap[job.job_type?.toLowerCase() || ''] || 'FULL_TIME';

  // Calculate dates
  const datePosted = job.created_at 
    ? new Date(job.created_at).toISOString()
    : new Date().toISOString();
  
  // validThrough is REQUIRED by Google - default to 30 days from posting if not set
  const validThrough = job.expires_at 
    ? new Date(job.expires_at).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Parse location for structured data
  const locationParts = parseLocation(job.location);
  const city = job.city || job.district || locationParts.city;
  const state = job.state || locationParts.state;
  const postalCode = job.postal_code || getCityPostalCode(city, state);
  
  // Prepare image URLs for structured data
  const defaultLogo = `https://worklyindia.devs.surf/icons/icon-512x512.png`;
  const logoUrl = companyLogoUrl || defaultLogo;
  
  // Build the structured data
  const schema: any = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": job.title,
    "description": job.description,
    "identifier": {
      "@type": "PropertyValue",
      "name": BRAND_CONFIG.name,
      "value": job.id
    },
    "datePosted": datePosted,
    "validThrough": validThrough,
    "employmentType": employmentType,
    // Add images for Google Jobs rich results
    "image": jobImageUrl ? [jobImageUrl, logoUrl] : [logoUrl],
    "hiringOrganization": {
      "@type": "Organization",
      "name": companyName,
      "sameAs": companyWebsite || SITE_URL,
      "logo": logoUrl
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": job.is_remote !== false ? "Workly India" : (city + ", " + state),
        "addressLocality": city,
        "addressRegion": state,
        "postalCode": postalCode,
        "addressCountry": "IN"
      }
    },
    // Add industry for better categorization
    ...(job.category && { "industry": job.category })
  };

  // Add Workly India properties
  if (job.is_remote !== false) {
    schema.jobLocationType = "TELECOMMUTE";
    schema.applicantLocationRequirements = {
      "@type": "Country",
      "name": "India"
    };
  }

  // Add salary information - REQUIRED: must have "value" field properly structured
  if (job.salary_min || job.salary_max) {
    const minSalary = job.salary_min || job.salary_max || 0;
    const maxSalary = job.salary_max || job.salary_min || 0;
    
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      "currency": "INR",
      "value": {
        "@type": "QuantitativeValue",
        "value": Math.round((minSalary + maxSalary) / 2), // Google prefers single "value" field
        "minValue": minSalary,
        "maxValue": maxSalary,
        "unitText": "MONTH"
      }
    };
  } else {
    // Provide default salary range for remote jobs in India if not specified
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      "currency": "INR",
      "value": {
        "@type": "QuantitativeValue",
        "value": 25000, // Default middle value
        "minValue": 15000,
        "maxValue": 50000,
        "unitText": "MONTH"
      }
    };
  }

  // Add experience requirements - only if experience > 0 (skip for freshers)
  if (job.experience_level) {
    const expLevel = job.experience_level.toLowerCase();
    const yearsMatch = expLevel.match(/(\d+)\s*[-–]\s*(\d+)/) || expLevel.match(/(\d+)\s*\+?/);
    const years = yearsMatch ? Number(yearsMatch[1]) : (expLevel.includes('fresher') ? 0 : NaN);
    
    // Only add if years > 0 (fixes "monthsOfExperience must be positive" warning)
    if (!Number.isNaN(years) && years > 0) {
      schema.experienceRequirements = {
        "@type": "OccupationalExperienceRequirements",
        "monthsOfExperience": Math.max(1, Math.round(years * 12))
      };
    }
  }

  // Add education requirements
  if (job.education_required) {
    schema.educationRequirements = {
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": job.education_required
    };
  }

  // Add skills
  if (job.skills && job.skills.length > 0) {
    schema.skills = job.skills.join(', ');
  }

  // Add benefits
  if (job.benefits && job.benefits.length > 0) {
    schema.jobBenefits = job.benefits.join(', ');
  }

  // Add direct apply action
  schema.directApply = true;

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default JobPostingStructuredData;
