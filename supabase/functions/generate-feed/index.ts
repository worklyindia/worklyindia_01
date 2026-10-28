import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WEBSITE_DOMAIN } from "../_shared/domain.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = WEBSITE_DOMAIN;
const SITE_NAME = 'Workly India';
const SITE_DESCRIPTION = 'Latest Workly India jobs, remote opportunities, and career guidance from Workly India';
const SITE_LOGO = `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`;
const SITE_EMAIL = 'worklyindia@outlook.com';

// All supported job categories for category-wise feeds
const JOB_CATEGORIES = [
  'Data Entry', 'Customer Support', 'Content Writing', 'Digital Marketing',
  'Web Development', 'Graphic Design', 'Virtual Assistant', 'Teaching',
  'Accounting', 'Sales', 'HR', 'Social Media', 'Transcription',
  'Translation', 'Video Editing', 'App Development', 'SEO',
  'Email Marketing', 'Chat Support', 'Technical Support'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'rss';
    const type = url.searchParams.get('type') || 'all';
    const lang = url.searchParams.get('lang') || 'en';
    const category = url.searchParams.get('category') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    // Special endpoint: list all available category feeds
    if (url.searchParams.get('list') === 'categories') {
      return new Response(JSON.stringify({
        categories: JOB_CATEGORIES,
        feeds: JOB_CATEGORIES.map(cat => ({
          name: cat,
          rss: `${SITE_URL}/rss/${cat.toLowerCase().replace(/\s+/g, '-')}.xml`,
          atom: `${SITE_URL}/atom/${cat.toLowerCase().replace(/\s+/g, '-')}.xml`,
        })),
        main_feeds: {
          all: `${SITE_URL}/feed.xml`,
          jobs: `${SITE_URL}/rss/jobs.xml`,
          blog: `${SITE_URL}/rss/blog.xml`,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Feed] Generating ${format} feed | type: ${type} | lang: ${lang} | category: ${category} | limit: ${limit}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let items: FeedItem[] = [];

    // Fetch jobs with rich details
    if (type === 'jobs' || type === 'all') {
      let query = supabase
        .from('jobs')
        .select(`
          id, public_slug, title, description, company_name, created_at, updated_at,
          location, salary_min, salary_max, category, job_type, experience_level,
          skills, work_mode, qualification, vacancies, apply_url, company_logo,
          city, state, country, is_verified, is_boosted
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.ilike('category', `%${category}%`);
      }

      const { data: jobs } = await query;

      if (jobs) {
        items.push(...jobs.map(job => {
          const jobUrl = `${SITE_URL}/job/${job.public_slug || job.id}`;
          const salaryText = formatSalaryRange(job.salary_min, job.salary_max);
          const skills = Array.isArray(job.skills) ? job.skills : [];
          
          // Rich HTML content for content:encoded
          const richContent = buildJobRichContent(job, jobUrl, salaryText, skills);

          return {
            type: 'job' as const,
            title: `${job.title}${job.company_name ? ` at ${job.company_name}` : ''}`,
            description: truncateText(stripHtml(job.description || ''), 300),
            richContent,
            link: jobUrl,
            guid: `${SITE_URL}/job/${job.id}`,
            pubDate: new Date(job.created_at).toUTCString(),
            updatedDate: job.updated_at ? new Date(job.updated_at).toISOString() : undefined,
            category: job.category || 'Jobs',
            salary: salaryText,
            location: [job.city, job.state, job.country].filter(Boolean).join(', ') || job.location || 'Remote, India',
            author: job.company_name || 'Workly India',
            image: job.company_logo || undefined,
            jobType: job.job_type || undefined,
            experience: job.experience_level || undefined,
            skills,
            workMode: job.work_mode || undefined,
            qualification: job.qualification || undefined,
            vacancies: job.vacancies || undefined,
            applyUrl: job.apply_url || jobUrl,
            isVerified: job.is_verified || false,
            isBoosted: job.is_boosted || false,
          };
        }));
      }
    }

    // Fetch blog posts
    if (type === 'blog' || type === 'all') {
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('id, slug, title, excerpt, content, author, published_at, category, image_url, created_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(Math.min(limit, 30));

      if (posts) {
        items.push(...posts.map(post => ({
          type: 'article' as const,
          title: post.title,
          description: post.excerpt || truncateText(stripHtml(post.content || ''), 300),
          richContent: post.content || post.excerpt || '',
          link: `${SITE_URL}/blog/${post.slug}`,
          guid: `${SITE_URL}/blog/${post.id}`,
          pubDate: new Date(post.published_at || post.created_at).toUTCString(),
          category: post.category || 'Career Tips',
          author: post.author || 'Workly India Team',
          image: post.image_url,
        })));
      }
    }

    // Sort by date (newest first)
    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Build self URL
    const selfPath = category
      ? `/rss/${category.toLowerCase().replace(/\s+/g, '-')}.xml`
      : type === 'jobs' ? '/rss/jobs.xml'
      : type === 'blog' ? '/rss/blog.xml'
      : '/feed.xml';
    const selfUrl = `${SITE_URL}${selfPath}`;

    let output: string;
    let contentType: string;

    if (format === 'atom') {
      output = generateAtomFeed(items, lang, selfUrl);
      contentType = 'application/atom+xml; charset=utf-8';
    } else if (format === 'json') {
      output = generateJSONFeed(items, lang, selfUrl);
      contentType = 'application/feed+json; charset=utf-8';
    } else {
      output = generateRSSFeed(items, lang, selfUrl, category);
      contentType = 'application/rss+xml; charset=utf-8';
    }

    console.log(`[Feed] Generated ${format} feed with ${items.length} items`);

    return new Response(output, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        // Short cache = feed updates faster when new jobs posted
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'X-Feed-Items': items.length.toString(),
        'X-Feed-Generated': new Date().toISOString(),
      },
    });

  } catch (error: unknown) {
    console.error('[Feed] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== Types ====================

interface FeedItem {
  type: 'job' | 'article';
  title: string;
  description: string;
  richContent?: string;
  link: string;
  guid: string;
  pubDate: string;
  updatedDate?: string;
  category: string;
  salary?: string;
  location?: string;
  author?: string;
  image?: string;
  jobType?: string;
  experience?: string;
  skills?: string[];
  workMode?: string;
  qualification?: string;
  vacancies?: number;
  applyUrl?: string;
  isVerified?: boolean;
  isBoosted?: boolean;
}

// ==================== RSS 2.0 Feed ====================

function generateRSSFeed(items: FeedItem[], lang: string, selfUrl: string, category?: string): string {
  const now = new Date().toUTCString();
  const isHindi = lang === 'hi';
  const langCode = isHindi ? 'hi-IN' : 'en-IN';
  
  const feedTitle = category
    ? `${category} Jobs - ${SITE_NAME}`
    : isHindi ? 'Workly India - घर बैठे नौकरी' : `${SITE_NAME} - Workly India Jobs`;
  const feedDesc = category
    ? `Latest ${category} Workly India jobs in India`
    : isHindi ? 'भारत में घर बैठे नौकरी, रिमोट वर्क के अवसर और करियर मार्गदर्शन' : SITE_DESCRIPTION;

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:sy="http://purl.org/rss/1.0/modules/syndication/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <description>${escapeXml(feedDesc)}</description>
    <link>${SITE_URL}/</link>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
    <atom:link href="${SITE_URL}/feed.xml" rel="alternate" hreflang="en" type="application/rss+xml" />
    <atom:link href="${SITE_URL}/feed-hi.xml" rel="alternate" hreflang="hi" type="application/rss+xml" />
    <language>${langCode}</language>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <generator>${SITE_NAME} RSS Generator</generator>
    <copyright>Copyright ${new Date().getFullYear()} ${SITE_NAME}</copyright>
    <managingEditor>${SITE_EMAIL} (${SITE_NAME})</managingEditor>
    <webMaster>${SITE_EMAIL} (${SITE_NAME})</webMaster>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
    <image>
      <url>${SITE_LOGO}</url>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${SITE_URL}/</link>
      <width>144</width>
      <height>144</height>
    </image>
    <ttl>15</ttl>`;

  for (const item of items) {
    rss += `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <description><![CDATA[${item.description}]]></description>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <category>${escapeXml(item.category)}</category>`;

    if (item.author) {
      rss += `
      <dc:creator><![CDATA[${item.author}]]></dc:creator>`;
    }

    if (item.image) {
      rss += `
      <media:content url="${escapeXml(item.image)}" medium="image" />
      <media:thumbnail url="${escapeXml(item.image)}" />`;
    }

    // Rich content:encoded with full job details
    if (item.richContent) {
      rss += `
      <content:encoded><![CDATA[${item.richContent}]]></content:encoded>`;
    }

    rss += `
    </item>`;
  }

  rss += `
  </channel>
</rss>`;

  return rss;
}

// ==================== Atom Feed ====================

function generateAtomFeed(items: FeedItem[], lang: string, selfUrl: string): string {
  const now = new Date().toISOString();
  const isHindi = lang === 'hi';
  const feedTitle = isHindi ? 'Workly India - घर बैठे नौकरी' : `${SITE_NAME} - Workly India Jobs`;
  const feedDesc = isHindi
    ? 'भारत में घर बैठे नौकरी, रिमोट वर्क के अवसर और करियर मार्गदर्शन'
    : SITE_DESCRIPTION;

  let atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${isHindi ? 'hi' : 'en'}">
  <title>${escapeXml(feedTitle)}</title>
  <subtitle>${escapeXml(feedDesc)}</subtitle>
  <link href="${SITE_URL}/" rel="alternate" type="text/html"/>
  <link href="${escapeXml(selfUrl)}" rel="self" type="application/atom+xml"/>
  <id>${SITE_URL}/</id>
  <updated>${now}</updated>
  <author>
    <name>${SITE_NAME} Team</name>
    <email>${SITE_EMAIL}</email>
  </author>
  <icon>${SITE_LOGO}</icon>
  <logo>${SITE_LOGO}</logo>
  <rights>Copyright ${new Date().getFullYear()} ${SITE_NAME}</rights>`;

  for (const item of items) {
    atom += `
  <entry>
    <title><![CDATA[${item.title}]]></title>
    <link href="${escapeXml(item.link)}" rel="alternate"/>
    <id>${escapeXml(item.guid)}</id>
    <published>${new Date(item.pubDate).toISOString()}</published>
    <updated>${item.updatedDate || new Date(item.pubDate).toISOString()}</updated>
    <summary><![CDATA[${item.description}]]></summary>
    <category term="${escapeXml(item.category)}"/>`;

    if (item.author) {
      atom += `
    <author>
      <name><![CDATA[${item.author}]]></name>
    </author>`;
    }

    if (item.richContent) {
      atom += `
    <content type="html"><![CDATA[${item.richContent}]]></content>`;
    }

    atom += `
  </entry>`;
  }

  atom += `
</feed>`;

  return atom;
}

// ==================== JSON Feed 1.1 ====================

function generateJSONFeed(items: FeedItem[], lang: string, selfUrl: string): string {
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${SITE_NAME} - Workly India Jobs`,
    home_page_url: `${SITE_URL}/`,
    feed_url: selfUrl,
    description: SITE_DESCRIPTION,
    icon: SITE_LOGO,
    favicon: `${SITE_URL}/favicon.ico`,
    language: lang === 'hi' ? 'hi-IN' : 'en-IN',
    authors: [{ name: `${SITE_NAME} Team`, url: SITE_URL }],
    items: items.map(item => ({
      id: item.guid,
      url: item.link,
      title: item.title,
      content_text: item.description,
      content_html: item.richContent || item.description,
      date_published: new Date(item.pubDate).toISOString(),
      ...(item.updatedDate && { date_modified: item.updatedDate }),
      ...(item.author && { authors: [{ name: item.author }] }),
      ...(item.image && { image: item.image }),
      tags: [item.category, ...(item.skills || [])].filter(Boolean),
      _workly: {
        type: item.type,
        ...(item.salary && { salary: item.salary }),
        ...(item.location && { location: item.location }),
        ...(item.jobType && { job_type: item.jobType }),
        ...(item.experience && { experience: item.experience }),
        ...(item.workMode && { work_mode: item.workMode }),
        ...(item.applyUrl && { apply_url: item.applyUrl }),
        ...(item.isVerified && { verified: true }),
      },
    })),
  };

  return JSON.stringify(feed, null, 2);
}

// ==================== Rich Content Builder ====================

function buildJobRichContent(job: any, jobUrl: string, salaryText: string, skills: string[]): string {
  const parts: string[] = [];

  // Header with logo
  if (job.company_logo) {
    parts.push(`<p><img src="${escapeXml(job.company_logo)}" alt="${escapeXml(job.company_name || '')}" width="60" height="60" style="border-radius:8px" /></p>`);
  }

  parts.push(`<h2>${escapeXml(job.title)}</h2>`);

  // Key details table
  const details: string[] = [];
  if (job.company_name) details.push(`<strong>🏢 Company:</strong> ${escapeXml(job.company_name)}`);
  if (salaryText) details.push(`<strong>💰 Salary:</strong> ${escapeXml(salaryText)}`);
  
  const loc = [job.city, job.state, job.country].filter(Boolean).join(', ') || job.location;
  if (loc) details.push(`<strong>📍 Location:</strong> ${escapeXml(loc)}`);
  
  if (job.job_type) details.push(`<strong>⏰ Type:</strong> ${escapeXml(job.job_type)}`);
  if (job.work_mode) details.push(`<strong>🏠 Mode:</strong> ${escapeXml(job.work_mode)}`);
  if (job.experience_level) details.push(`<strong>📊 Experience:</strong> ${escapeXml(job.experience_level)}`);
  if (job.qualification) details.push(`<strong>🎓 Qualification:</strong> ${escapeXml(job.qualification)}`);
  if (job.vacancies) details.push(`<strong>👥 Vacancies:</strong> ${job.vacancies}`);
  if (job.is_verified) details.push(`<strong>✅ Verified Job</strong>`);

  if (details.length > 0) {
    parts.push(`<p>${details.join('<br/>')}</p>`);
  }

  // Skills
  if (skills.length > 0) {
    parts.push(`<p><strong>🔧 Skills:</strong> ${skills.map(s => escapeXml(String(s))).join(', ')}</p>`);
  }

  // Description (truncated)
  const desc = truncateText(stripHtml(job.description || ''), 500);
  if (desc) {
    parts.push(`<p>${escapeXml(desc)}</p>`);
  }

  // Apply CTA
  const applyLink = job.apply_url || jobUrl;
  parts.push(`<p><a href="${escapeXml(applyLink)}" style="background:#2563eb;color:#fff;padding:8px 20px;text-decoration:none;border-radius:6px;font-weight:bold">Apply Now →</a></p>`);
  parts.push(`<p><a href="${escapeXml(jobUrl)}">View Full Details on ${SITE_NAME}</a></p>`);

  return parts.join('\n');
}

// ==================== Utility Functions ====================

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function formatSalaryRange(min: number | null | undefined, max: number | null | undefined): string {
  if (!min && !max) return '';
  const fMin = min ? formatSalary(min) : '0';
  const fMax = max ? formatSalary(max) : '';
  if (fMin && fMax) return `₹${fMin} - ₹${fMax}/month`;
  if (fMin) return `₹${fMin}/month`;
  return `Up to ₹${fMax}/month`;
}

function formatSalary(amount: number): string {
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return amount.toString();
}
