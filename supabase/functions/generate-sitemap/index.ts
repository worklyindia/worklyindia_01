import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WEBSITE_DOMAIN } from "../_shared/domain.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = WEBSITE_DOMAIN;

// Timeout helper for database queries
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
    )
  ]);
};

// Retry helper for flaky queries
const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 500): Promise<T> => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries) throw error;
      console.log(`[Sitemap] Retry ${i + 1}/${retries} after error:`, error);
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error('Retry failed');
};

// Cache helper - get cached sitemap from database
async function getCachedSitemap(supabase: any, type: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('sitemap_cache')
      .select('xml_content, expires_at')
      .eq('type', type)
      .single();
    
    if (data && new Date(data.expires_at) > new Date()) {
      console.log(`[Sitemap] Cache hit for ${type}`);
      return data.xml_content;
    }
    console.log(`[Sitemap] Cache miss for ${type}`);
    return null;
  } catch {
    return null;
  }
}

// Cache helper - save sitemap to database
async function cacheSitemap(supabase: any, type: string, xml: string): Promise<void> {
  try {
    await supabase.from('sitemap_cache').upsert({
      type,
      xml_content: xml,
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      updated_at: new Date().toISOString()
    }, { onConflict: 'type' });
    console.log(`[Sitemap] Cached ${type} sitemap`);
  } catch (e) {
    console.error(`[Sitemap] Failed to cache ${type}:`, e);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle HEAD requests (Google sometimes uses HEAD to check sitemap availability)
  if (req.method === 'HEAD') {
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      }
    });
  }

  const startTime = Date.now();
  
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'index';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = 1000; // Max URLs per sitemap
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    console.log(`[Sitemap] Generating sitemap type: ${type}, page: ${page}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (except for forced refresh)
    const cacheKey = page > 1 ? `${type}_${page}` : type;
    if (!forceRefresh) {
      const cached = await getCachedSitemap(supabase, cacheKey);
      if (cached) {
        const duration = Date.now() - startTime;
        return new Response(cached, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
            'X-Sitemap-Generation-Time': `${duration}ms`,
            'X-Sitemap-Cache': 'HIT',
          },
        });
      }
    }

    let xml = '';

    switch (type) {
      case 'index':
        xml = await withRetry(() => withTimeout(generateSitemapIndex(supabase), 15000));
        break;
      case 'static':
        xml = generateStaticSitemap();
        break;
      case 'jobs':
        xml = await withRetry(() => withTimeout(generateJobsSitemap(supabase, page, limit), 15000));
        break;
      case 'blog':
        xml = await withRetry(() => withTimeout(generateBlogSitemap(supabase, page, limit), 15000));
        break;
      case 'companies':
        xml = await withRetry(() => withTimeout(generateCompaniesSitemap(supabase, page, limit), 15000));
        break;
      default:
        xml = await withRetry(() => withTimeout(generateSitemapIndex(supabase), 15000));
    }

    // Cache the generated sitemap
    await cacheSitemap(supabase, cacheKey, xml);

    const duration = Date.now() - startTime;
    console.log(`[Sitemap] Successfully generated ${type} sitemap in ${duration}ms`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        'X-Sitemap-Generation-Time': `${duration}ms`,
        'X-Sitemap-Cache': 'MISS',
      },
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error(`[Sitemap] Generation error after ${duration}ms:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return a valid empty sitemap instead of JSON error for Google compatibility
    const emptySitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/jobs</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/blog</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/hiring-companies</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
    
    return new Response(emptySitemap, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Sitemap-Error': errorMessage.substring(0, 100),
      },
    });
  }
});

async function generateSitemapIndex(supabase: any): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  let jobsCount = 0;
  let blogCount = 0;
  let companiesCount = 0;

  try {
    const { count: jc } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    jobsCount = jc || 0;
  } catch (e) {
    console.error('[Sitemap] Error counting jobs:', e);
  }
  
  try {
    const { count: bc } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);
    blogCount = bc || 0;
  } catch (e) {
    console.error('[Sitemap] Error counting blog posts:', e);
  }

  try {
    const { count: cc } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('account_status', 'active')
      .eq('is_verified', true);
    companiesCount = cc || 0;
  } catch (e) {
    console.error('[Sitemap] Error counting companies:', e);
  }

  const jobPages = Math.max(Math.ceil(jobsCount / 1000), 1);
  const blogPages = Math.max(Math.ceil(blogCount / 1000), 1);
  const companyPages = Math.max(Math.ceil(companiesCount / 1000), 1);

  console.log(`[Sitemap] Index counts - Jobs: ${jobsCount}, Blog: ${blogCount}, Companies: ${companiesCount}`);

  // Use clean XML URLs instead of query params for better Google compatibility
  let sitemaps = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/dynamic-static-sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;

  // Add job sitemap pages with clean URLs
  for (let i = 1; i <= jobPages; i++) {
    sitemaps += `
  <sitemap>
    <loc>${SITE_URL}/dynamic-jobs-sitemap-${i}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  }

  // Add blog sitemap pages with clean URLs
  for (let i = 1; i <= blogPages; i++) {
    sitemaps += `
  <sitemap>
    <loc>${SITE_URL}/dynamic-blog-sitemap-${i}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  }

  // Add company sitemap pages with clean URLs
  for (let i = 1; i <= companyPages; i++) {
    sitemaps += `
  <sitemap>
    <loc>${SITE_URL}/dynamic-companies-sitemap-${i}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  }

  sitemaps += `
</sitemapindex>`;

  return sitemaps;
}

function generateStaticSitemap(): string {
  const today = new Date().toISOString().split('T')[0];
  
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/jobs', priority: '0.9', changefreq: 'hourly' },
    { url: '/hot-leads', priority: '0.9', changefreq: 'hourly' },
    { url: '/all-leads', priority: '0.8', changefreq: 'daily' },
    { url: '/jobs-for-women', priority: '0.8', changefreq: 'daily' },
    { url: '/hiring-companies', priority: '0.8', changefreq: 'daily' },
    { url: '/blog', priority: '0.8', changefreq: 'daily' },
    { url: '/company-directory', priority: '0.7', changefreq: 'weekly' },
    { url: '/career-guidance', priority: '0.7', changefreq: 'weekly' },
    { url: '/interview-tips', priority: '0.7', changefreq: 'weekly' },
    { url: '/resume-builder', priority: '0.8', changefreq: 'weekly' },
    { url: '/skill-assessment', priority: '0.7', changefreq: 'weekly' },
    { url: '/ai-assistant', priority: '0.7', changefreq: 'weekly' },
    { url: '/ai-assistant?tab=ai-chat', priority: '0.7', changefreq: 'weekly' },
    { url: '/free-job-alerts', priority: '0.8', changefreq: 'weekly' },
    { url: '/about-us', priority: '0.6', changefreq: 'monthly' },
    { url: '/contact-us', priority: '0.6', changefreq: 'monthly' },
    { url: '/faq', priority: '0.6', changefreq: 'monthly' },
    { url: '/help-center', priority: '0.6', changefreq: 'monthly' },
    { url: '/our-services', priority: '0.7', changefreq: 'monthly' },
    { url: '/recruitment-solutions', priority: '0.7', changefreq: 'monthly' },
    { url: '/how-it-works', priority: '0.6', changefreq: 'monthly' },
    // Employer pages - now indexable
    { url: '/employer-portal', priority: '0.7', changefreq: 'weekly' },
    { url: '/post-job', priority: '0.7', changefreq: 'monthly' },
    { url: '/hire-portal-points', priority: '0.7', changefreq: 'weekly' },
    { url: '/employer/referral', priority: '0.7', changefreq: 'weekly' },
    { url: '/employer/monthly-competition', priority: '0.7', changefreq: 'weekly' },
    { url: '/employer/interviews', priority: '0.7', changefreq: 'daily' },
    // Auth pages
    { url: '/auth', priority: '0.5', changefreq: 'monthly' },
    { url: '/employer-auth', priority: '0.5', changefreq: 'monthly' },
    { url: '/login', priority: '0.5', changefreq: 'monthly' },
    { url: '/signup', priority: '0.5', changefreq: 'monthly' },
    { url: '/register', priority: '0.5', changefreq: 'monthly' },
    // Legal pages
    { url: '/privacy', priority: '0.4', changefreq: 'yearly' },
    { url: '/terms-and-conditions', priority: '0.4', changefreq: 'yearly' },
    { url: '/terms-conditions', priority: '0.4', changefreq: 'yearly' },
    { url: '/disclaimer', priority: '0.4', changefreq: 'yearly' },
    { url: '/job-policy', priority: '0.4', changefreq: 'yearly' },
    { url: '/refund-policy', priority: '0.4', changefreq: 'yearly' },
    // Other pages
    { url: '/reviews', priority: '0.6', changefreq: 'weekly' },
    { url: '/install', priority: '0.5', changefreq: 'monthly' },
    { url: '/quick-access', priority: '0.5', changefreq: 'weekly' },
    { url: '/sitemap', priority: '0.5', changefreq: 'weekly' },
    { url: '/were-hiring', priority: '0.6', changefreq: 'weekly' },
    { url: '/team-diary', priority: '0.5', changefreq: 'weekly' },
    { url: '/case-studies', priority: '0.6', changefreq: 'monthly' },
    { url: '/college-tpo', priority: '0.6', changefreq: 'monthly' },
    { url: '/hire-interns', priority: '0.6', changefreq: 'monthly' },
    { url: '/career-tricks', priority: '0.7', changefreq: 'weekly' },
    { url: '/press-kit', priority: '0.5', changefreq: 'monthly' },
  ];

  // Job category pages
  const categories = [
    'data-entry', 'customer-support', 'content-writing', 'graphic-design',
    'web-development', 'digital-marketing', 'virtual-assistant', 'teaching',
    'sales', 'accounting', 'hr', 'translation', 'video-editing', 'seo',
    'social-media', 'app-development', 'consulting', 'research'
  ];

  // Location pages
  const locations = [
    'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'pune',
    'ahmedabad', 'kolkata', 'jaipur', 'lucknow', 'surat', 'indore',
    'bhopal', 'nagpur', 'chandigarh', 'patna', 'gurgaon', 'noida'
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Static pages
  for (const page of staticPages) {
    xml += `
  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  // Category pages - SEO-friendly clean URLs
  for (const category of categories) {
    xml += `
  <url>
    <loc>${SITE_URL}/jobs/category/${category}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  // Location pages - SEO-friendly clean URLs
  for (const location of locations) {
    xml += `
  <url>
    <loc>${SITE_URL}/jobs/location/${location}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  return xml;
}

async function generateJobsSitemap(supabase: any, page: number, limit: number): Promise<string> {
  const offset = (page - 1) * limit;
  const today = new Date().toISOString().split('T')[0];

  let jobs: any[] = [];
  
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, public_slug, short_id, title, updated_at, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Sitemap] Error fetching jobs:', error);
    } else {
      jobs = data || [];
      console.log(`[Sitemap] Fetched ${jobs.length} jobs with public_slugs`);
    }
  } catch (e) {
    console.error('[Sitemap] Exception fetching jobs:', e);
  }

  console.log(`[Sitemap] Jobs sitemap page ${page}: ${jobs.length} jobs`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Always include main jobs page as fallback
  if (jobs.length === 0) {
    xml += `
  <url>
    <loc>${SITE_URL}/jobs</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/hot-leads</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/all-leads</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/jobs-for-women</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  for (const job of jobs) {
    const lastmod = job.updated_at 
      ? new Date(job.updated_at).toISOString().split('T')[0]
      : job.created_at 
        ? new Date(job.created_at).toISOString().split('T')[0]
        : today;
    
    // Always use full UUID for sitemap URLs for consistent SEO indexing
    // public_slug is OK as it's user-friendly, but skip short_id
    const jobUrl = job.public_slug 
      ? `/job/${job.public_slug}` 
      : `/job/${job.id}`;
    
    xml += `
  <url>
    <loc>${SITE_URL}${jobUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  return xml;
}

async function generateBlogSitemap(supabase: any, page: number, limit: number): Promise<string> {
  const offset = (page - 1) * limit;
  const today = new Date().toISOString().split('T')[0];

  let posts: any[] = [];

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title, updated_at, published_at, image_url')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Sitemap] Error fetching blog posts:', error);
    } else {
      posts = data || [];
    }
  } catch (e) {
    console.error('[Sitemap] Exception fetching blog posts:', e);
  }

  console.log(`[Sitemap] Blog sitemap page ${page}: ${posts.length} posts`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Always include main blog page as fallback
  if (posts.length === 0) {
    xml += `
  <url>
    <loc>${SITE_URL}/blog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/career-guidance</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${SITE_URL}/interview-tips</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  for (const post of posts) {
    const lastmod = post.updated_at 
      ? new Date(post.updated_at).toISOString().split('T')[0]
      : post.published_at
        ? new Date(post.published_at).toISOString().split('T')[0]
        : today;
    
    xml += `
  <url>
    <loc>${SITE_URL}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  return xml;
}

async function generateCompaniesSitemap(supabase: any, page: number, limit: number): Promise<string> {
  const offset = (page - 1) * limit;
  const today = new Date().toISOString().split('T')[0];

  let companies: any[] = [];

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, updated_at, created_at, logo_url')
      .eq('account_status', 'active')
      .eq('is_verified', true)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Sitemap] Error fetching companies:', error);
    } else {
      companies = data || [];
    }
  } catch (e) {
    console.error('[Sitemap] Exception fetching companies:', e);
  }

  console.log(`[Sitemap] Companies sitemap page ${page}: ${companies.length} companies`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Always include main company pages as fallback
  if (companies.length === 0) {
    xml += `
  <url>
    <loc>${SITE_URL}/company-directory</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${SITE_URL}/hiring-companies</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  for (const company of companies) {
    const lastmod = company.updated_at 
      ? new Date(company.updated_at).toISOString().split('T')[0]
      : company.created_at
        ? new Date(company.created_at).toISOString().split('T')[0]
        : today;
    
    xml += `
  <url>
    <loc>${SITE_URL}/company-profile/${company.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  return xml;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
