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

    const today = new Date().toISOString().split("T")[0];

    // Fetch active jobs with SEO-friendly slugs and images
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id, public_slug, short_id, updated_at, created_at, title,
        job_images (image_url, alt_text)
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw jobsError;
    }

    // Fetch verified companies with slugs
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, slug, short_id, updated_at")
      .eq("is_verified", true)
      .eq("account_status", "active")
      .limit(500);

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
    }

    // Fetch published blog posts
    const { data: blogs, error: blogsError } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at")
      .eq("is_published", true)
      .limit(200);

    if (blogsError) {
      console.error("Error fetching blogs:", blogsError);
    }

    // Build XML sitemap with image support
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    // Add job URLs with SEO-friendly slugs and images
    if (jobs && jobs.length > 0) {
      xml += `  <!-- Dynamic Job Pages (${jobs.length} jobs) -->\n`;
      for (const job of jobs) {
        const jobUrl = job.public_slug
          ? `${PRODUCTION_DOMAIN}/job/${job.public_slug}`
          : job.short_id
          ? `${PRODUCTION_DOMAIN}/j/${job.short_id}`
          : `${PRODUCTION_DOMAIN}/job/${job.id}`;
        
        const lastmod = job.updated_at
          ? new Date(job.updated_at).toISOString().split("T")[0]
          : today;

        // Get job images if available
        const jobImages = (job as any).job_images || [];
        const hasImages = jobImages.length > 0;

        xml += `  <url>
    <loc>${escapeXml(jobUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>`;
        
        // Add image elements for Google Image indexing
        if (hasImages) {
          for (const img of jobImages.slice(0, 3)) {
            if (img.image_url) {
              xml += `
    <image:image>
      <image:loc>${escapeXml(img.image_url)}</image:loc>
      <image:title>${escapeXml(img.alt_text || `${(job as any).title} - Workly India Job`)}</image:title>
    </image:image>`;
            }
          }
        }
        
        xml += `
  </url>\n`;
      }
    }

    // Add company URLs
    if (companies && companies.length > 0) {
      xml += `  <!-- Dynamic Company Pages (${companies.length} companies) -->\n`;
      for (const company of companies) {
        const companyUrl = company.slug
          ? `${PRODUCTION_DOMAIN}/company/${company.slug}`
          : company.short_id
          ? `${PRODUCTION_DOMAIN}/c/${company.short_id}`
          : `${PRODUCTION_DOMAIN}/company/${company.id}`;
        
        const lastmod = company.updated_at
          ? new Date(company.updated_at).toISOString().split("T")[0]
          : today;

        xml += `  <url>
    <loc>${escapeXml(companyUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
      }
    }

    // Add blog URLs
    if (blogs && blogs.length > 0) {
      xml += `  <!-- Dynamic Blog Posts (${blogs.length} posts) -->\n`;
      for (const blog of blogs) {
        const blogUrl = `${PRODUCTION_DOMAIN}/blog/${blog.slug}`;
        const lastmod = blog.updated_at
          ? new Date(blog.updated_at).toISOString().split("T")[0]
          : blog.published_at
          ? new Date(blog.published_at).toISOString().split("T")[0]
          : today;

        xml += `  <url>
    <loc>${escapeXml(blogUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
      }
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate sitemap" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
