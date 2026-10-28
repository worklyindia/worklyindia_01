import { storageImageUrl } from "@/utils/imageUrl";
import { Helmet } from "react-helmet-async";
import { useBrandAssets } from "@/hooks/useBrandAssets";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { CANONICAL_URL } from "@/config/domainConfig";
import { BRAND_CONFIG } from "@/config/brandConfig";

export const BrandMetaTags = () => {
  const brandAssets = useBrandAssets();
  const { socialLinks } = useSocialLinks();

  // Get site URL - use production URL
  const siteUrl = CANONICAL_URL;
  
  const ogTitle = brandAssets.og_title || brandAssets.brand_name || BRAND_CONFIG.name;
  const ogDescription = brandAssets.og_description || brandAssets.brand_tagline || BRAND_CONFIG.tagline;
  
  // Convert to absolute URL for OG image, then route Supabase Storage images
  // through the free CDN proxy so social crawlers don't burn Cached Egress.
  const relativeOgImage = brandAssets.og_image_url || brandAssets.logo_url || 'https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png';
  const absoluteOgImage = relativeOgImage.startsWith('http') 
    ? relativeOgImage 
    : `${siteUrl}${relativeOgImage.startsWith('/') ? relativeOgImage : '/' + relativeOgImage}`;
  const ogImage = storageImageUrl(absoluteOgImage, 1200, 80) || absoluteOgImage;
  
  // Favicon + touch icons: always local static files (zero Supabase egress).
  const faviconUrl = brandAssets.favicon_url;
  
  // Get Twitter handle (remove @ if present)
  const twitterHandle = socialLinks.twitter?.replace(/^@/, '').replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, '');

  // Touch icons: static local files — brand logo PNG was ~99 KB per install prompt.
  const appleTouchIcon = '/icons/icon-192x192.png?v=20261022';

  return (
    <Helmet>
      {/* Favicon */}
      <link rel="icon" type="image/png" href={faviconUrl} />
      <link rel="apple-touch-icon" sizes="192x192" href={appleTouchIcon} />
      <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png?v=20261022" />

      {/* Primary Meta Tags */}
      <title>{ogTitle}</title>
      <meta name="title" content={ogTitle} />
      <meta name="description" content={ogDescription} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={window.location.href} />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:alt" content={`${ogTitle} - ${ogDescription}`} />
      {socialLinks.facebook && <meta property="article:publisher" content={socialLinks.facebook} />}

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={window.location.href} />
      <meta property="twitter:title" content={ogTitle} />
      <meta property="twitter:description" content={ogDescription} />
      <meta property="twitter:image" content={ogImage} />
      <meta property="twitter:image:alt" content={`${ogTitle} - ${ogDescription}`} />
      {twitterHandle && <meta property="twitter:site" content={`@${twitterHandle}`} />}
      {twitterHandle && <meta property="twitter:creator" content={`@${twitterHandle}`} />}

      {/* WhatsApp, Telegram, Instagram use Open Graph tags */}

      {/* Yandex Webmaster Verification */}
      <meta name="yandex-verification" content="f52ae84aa3774712" />

      {/* Pinterest Verification */}
      <meta name="p:domain_verify" content="df53a27a0fb7ea5714bd385a41a2c178" />
    </Helmet>
  );
};
