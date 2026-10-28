import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_NAME } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;
interface VideoStructuredDataProps {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string; // ISO 8601 format: PT1M30S
  contentUrl?: string;
  embedUrl?: string;
}

export const VideoStructuredData = ({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  contentUrl,
  embedUrl
}: VideoStructuredDataProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl.startsWith('http') ? thumbnailUrl : `${SITE_URL}${thumbnailUrl}`,
    "uploadDate": uploadDate,
    ...(duration && { "duration": duration }),
    ...(contentUrl && { "contentUrl": contentUrl }),
    ...(embedUrl && { "embedUrl": embedUrl }),
    "publisher": {
      "@type": "Organization",
      "name": BRAND_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`
      }
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default VideoStructuredData;
