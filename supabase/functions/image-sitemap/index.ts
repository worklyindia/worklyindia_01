import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { WEBSITE_DOMAIN } from "../_shared/domain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCTION_DOMAIN = WEBSITE_DOMAIN;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("📸 Generating Image Sitemap...");

    // Fetch jobs with images
    const { data: jobImages, error: jobImagesError } = await supabase
      .from("job_images")
      .select(`
        id,
        image_url,
        alt_text,
        caption,
        seo_title,
        job_id,
        jobs!inner (
          id,
          title,
          public_slug,
          short_id,
          status
        )
      `)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (jobImagesError) {
      console.error("Error fetching job images:", jobImagesError);
      throw jobImagesError;
    }

    // Fetch active hero banners (homepage banner images)
    const { data: heroBanners, error: heroBannersError } = await supabase
      .rpc("get_active_hero_banners");

    if (heroBannersError) {
      console.error("Error fetching hero banners:", heroBannersError);
    }

    const bannerImages = (heroBanners || [])
      .filter((b: any) => b.image_url)
      .map((b: any) => ({
        image_url: String(b.image_url).split("?")[0],
        title: b.title || "Workly India Homepage Banner",
      }));

    // Build XML Image Sitemap
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    // Group job images by job
    const jobImagesMap = new Map<string, any[]>();
    if (jobImages && jobImages.length > 0) {
      for (const img of jobImages) {
        const job = (img as any).jobs;
        if (!job || job.status !== "active") continue;
        
        const jobId = job.id;
        if (!jobImagesMap.has(jobId)) {
          jobImagesMap.set(jobId, []);
        }
        jobImagesMap.get(jobId)!.push({
          image_url: img.image_url,
          alt_text: img.alt_text || `${job.title} - Workly India Job India`,
          caption: img.caption || `Job opportunity: ${job.title}`,
          seo_title: img.seo_title || job.title,
          job
        });
      }
    }

    // Add job pages with images
    xml += `  <!-- Job Pages with Images (${jobImagesMap.size} jobs) -->\n`;
    for (const [jobId, images] of jobImagesMap) {
      const job = images[0].job;
      const jobUrl = job.public_slug
        ? `${PRODUCTION_DOMAIN}/job/${job.public_slug}`
        : job.short_id
        ? `${PRODUCTION_DOMAIN}/j/${job.short_id}`
        : `${PRODUCTION_DOMAIN}/job/${job.id}`;

      xml += `  <url>
    <loc>${escapeXml(jobUrl)}</loc>
`;
      
      // Add all images for this job (max 5 per URL)
      for (const img of images.slice(0, 5)) {
        xml += `    <image:image>
      <image:loc>${escapeXml(getSitemapImageUrl(img.image_url))}</image:loc>
      <image:title>${escapeXml(img.seo_title)}</image:title>
      <image:caption>${escapeXml(img.caption)}</image:caption>
    </image:image>
`;
      }
      
      xml += `  </url>\n`;
    }

    // Homepage: header logo + hero banner images only
    xml += `  <!-- Homepage: Header Logo + Hero Banners -->\n`;
    xml += `  <url>
    <loc>${escapeXml(`${PRODUCTION_DOMAIN}/`)}</loc>
    <image:image>
      <image:loc>${escapeXml(`${PRODUCTION_DOMAIN}/workly-india-logo.png`)}</image:loc>
      <image:title>Workly India Logo</image:title>
      <image:caption>Workly India - Find Remote Jobs in India</image:caption>
    </image:image>
`;
    for (const banner of bannerImages) {
      xml += `    <image:image>
      <image:loc>${escapeXml(getSitemapImageUrl(banner.image_url))}</image:loc>
      <image:title>${escapeXml(banner.title)}</image:title>
      <image:caption>${escapeXml(banner.title)} - Workly India</image:caption>
    </image:image>
`;
    }
    xml += `  </url>\n`;

    xml += `</urlset>`;

    const totalImages = (jobImagesMap.size || 0) + bannerImages.length + 1;
    console.log(`✅ Image Sitemap generated with ${totalImages} URLs`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating image sitemap:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate image sitemap" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Convert relative URLs to absolute URLs
function getAbsoluteImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  
  // Already absolute URL
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Relative URL - convert to absolute
  if (imageUrl.startsWith('/')) {
    return `${PRODUCTION_DOMAIN}${imageUrl}`;
  }
  
  return `${PRODUCTION_DOMAIN}/${imageUrl}`;
}

// Cached-egress control: image crawlers (Googlebot-Image etc.) fetch every
// image:loc URL we advertise. Serving them a wsrv.nl-capped rendition
// (max 1200px WebP, ~60-120 KB) instead of the full-size Supabase original
// (often 1-3 MB) cuts crawl-time storage egress to a one-time proxy fetch —
// wsrv.nl caches the result, so repeat crawls never touch our storage.
function getSitemapImageUrl(imageUrl: string): string {
  const absolute = getAbsoluteImageUrl(imageUrl);
  if (!absolute) return absolute;
  const isSupabaseStorage = /\.supabase\.(co|in)\/storage\//i.test(absolute);
  if (!isSupabaseStorage) return absolute;
  if (!/\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i.test(absolute)) return absolute;
  const proxy = new URL("https://wsrv.nl/");
  proxy.searchParams.set("url", absolute);
  proxy.searchParams.set("w", "1200");
  proxy.searchParams.set("we", "");
  proxy.searchParams.set("q", "78");
  proxy.searchParams.set("output", "webp");
  return proxy.toString();
}
