import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';

const SITE_URL = CANONICAL_URL;

interface CourseStructuredDataProps {
  name: string;
  description: string;
  provider?: string;
  url?: string;
  image?: string;
  courseMode?: 'online' | 'onsite' | 'blended';
  duration?: string; // ISO 8601 format
  educationalLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  isAccessibleForFree?: boolean;
  offers?: {
    price: number;
    priceCurrency?: string;
  };
  hasCourseInstance?: {
    startDate?: string;
    endDate?: string;
    courseMode?: string;
  };
}

export const CourseStructuredData = ({
  name,
  description,
  provider = 'Workly India',
  url,
  image,
  courseMode = 'online',
  duration,
  educationalLevel,
  isAccessibleForFree = true,
  offers,
  hasCourseInstance
}: CourseStructuredDataProps) => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": provider,
      "url": SITE_URL,
      "logo": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`
    },
    "url": url || SITE_URL,
    "image": image || `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`,
    "courseMode": courseMode,
    "isAccessibleForFree": isAccessibleForFree
  };

  if (duration) {
    schema.timeRequired = duration;
  }

  if (educationalLevel) {
    schema.educationalLevel = educationalLevel;
  }

  if (offers && !isAccessibleForFree) {
    schema.offers = {
      "@type": "Offer",
      "price": offers.price,
      "priceCurrency": offers.priceCurrency || "INR",
      "availability": "https://schema.org/InStock"
    };
  }

  if (hasCourseInstance) {
    schema.hasCourseInstance = {
      "@type": "CourseInstance",
      "courseMode": hasCourseInstance.courseMode || courseMode,
      ...(hasCourseInstance.startDate && { "startDate": hasCourseInstance.startDate }),
      ...(hasCourseInstance.endDate && { "endDate": hasCourseInstance.endDate })
    };
  }

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default CourseStructuredData;
