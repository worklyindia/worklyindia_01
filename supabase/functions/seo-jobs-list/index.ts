import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { WEBSITE_DOMAIN, buildUrl } from '../_shared/domain.ts'
import { BRAND_CONFIG } from '../_shared/brandConfig.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Job {
  id: string
  title: string
  public_slug: string | null
  category: string | null
  job_type: string | null
  salary_min: number | null
  salary_max: number | null
  salary_period: string | null
  location: string | null
  city: string | null
  state: string | null
  description: string | null
  requirements: string | null
  benefits: string | null
  experience_level: string | null
  is_featured: boolean
  trending_score: number | null
  created_at: string
  expires_at: string | null
  video_url: string | null
  video_url_1: string | null
  video_url_2: string | null
  companies: {
    id: string
    company_name: string
    slug: string | null
    logo_url: string | null
    is_verified: boolean
    location: string | null
    city: string | null
    state: string | null
    instagram_link: string | null
    facebook_link: string | null
    linkedin_link: string | null
    youtube_link: string | null
    website: string | null
    industry: string | null
  } | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch latest 100 active jobs with company details - using correct column names
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        public_slug,
        category,
        job_type,
        salary_min,
        salary_max,
        salary_period,
        location,
        city,
        state,
        description,
        requirements,
        benefits,
        experience_level,
        is_featured,
        trending_score,
        created_at,
        expires_at,
        video_url,
        video_url_1,
        video_url_2,
        companies (
          id,
          company_name,
          slug,
          logo_url,
          is_verified,
          location,
          city,
          state,
          instagram_link,
          facebook_link,
          linkedin_link,
          youtube_link,
          website,
          industry
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching jobs:', error)
      throw error
    }

    // Map the data to handle companies array (Supabase returns array for single relation)
    const jobsList: Job[] = (jobs || []).map((job: any) => ({
      ...job,
      companies: Array.isArray(job.companies) ? job.companies[0] : job.companies
    }))
    
    // Generate Schema.org JobPosting structured data
    const jobPostings = jobsList.map(job => {
      const jobSlug = job.public_slug || job.id
      const companySlug = job.companies?.slug || job.companies?.id
      
      return {
        "@type": "JobPosting",
        "title": job.title,
        "description": job.description?.substring(0, 500) || `${job.title} - Workly India opportunity in India`,
        "identifier": {
          "@type": "PropertyValue",
          "name": "Workly India",
          "value": job.id
        },
        "datePosted": job.created_at,
        "validThrough": job.expires_at || undefined,
        "employmentType": job.job_type?.toUpperCase() || "FULL_TIME",
        "hiringOrganization": job.companies ? {
          "@type": "Organization",
          "name": job.companies.company_name,
          "sameAs": buildUrl(`/company/${companySlug}`),
          "logo": job.companies.logo_url || undefined
        } : undefined,
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "IN",
            "addressLocality": job.city || job.location || "Remote - India",
            "addressRegion": job.state || undefined
          }
        },
        "jobLocationType": "TELECOMMUTE",
        "applicantLocationRequirements": {
          "@type": "Country",
          "name": "India"
        },
        "baseSalary": job.salary_min ? {
          "@type": "MonetaryAmount",
          "currency": "INR",
          "value": {
            "@type": "QuantitativeValue",
            "minValue": job.salary_min,
            "maxValue": job.salary_max || job.salary_min,
            "unitText": job.salary_period === 'hourly' ? 'HOUR' : 'MONTH'
          }
        } : undefined,
        "url": buildUrl(`/job/${jobSlug}`)
      }
    })

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Workly India Jobs in India",
      "description": "Browse latest verified Workly India job opportunities in India. All jobs are verified and from trusted employers.",
      "numberOfItems": jobsList.length,
      "itemListElement": jobPostings.map((job, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": job
      }))
    }

    // Format salary display
    const formatSalary = (job: Job): string => {
      if (!job.salary_min) return 'Salary: Negotiable'
      const min = job.salary_min >= 100000 
        ? `₹${(job.salary_min / 100000).toFixed(1)}L` 
        : `₹${(job.salary_min / 1000).toFixed(0)}K`
      const max = job.salary_max 
        ? (job.salary_max >= 100000 
          ? `₹${(job.salary_max / 100000).toFixed(1)}L` 
          : `₹${(job.salary_max / 1000).toFixed(0)}K`)
        : null
      return max ? `${min} - ${max}/${job.salary_period || 'month'}` : `${min}/${job.salary_period || 'month'}`
    }

    // Count unique companies and trending jobs
    const uniqueCompanies = new Set(jobsList.filter(j => j.companies).map(j => j.companies?.id)).size
    const featuredCount = jobsList.filter(j => j.is_featured).length
    const trendingCount = jobsList.filter(j => j.trending_score && j.trending_score > 0).length

    // Generate HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workly India Jobs India - ${jobsList.length}+ Latest Remote Job Opportunities | Workly India</title>
    <meta name="description" content="Browse ${jobsList.length}+ verified Workly India jobs in India. Find remote jobs in customer service, data entry, HR, content writing & more. 100% FREE for job seekers. Government registered (UDYAM-GJ-18-0022888). Apply now!">
    <meta name="keywords" content="Workly India jobs, remote jobs India, Workly India jobs, online jobs, part time jobs, full time remote jobs, verified employers, Workly India, genuine Workly India">
    <link rel="canonical" href="${WEBSITE_DOMAIN}/jobs">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph -->
    <meta property="og:title" content="Workly India Jobs India - ${jobsList.length}+ Verified Remote Opportunities">
    <meta property="og:description" content="Find genuine Workly India jobs across India. Browse latest, trending & featured remote jobs from verified employers. 100% FREE for job seekers.">
    <meta property="og:url" content="${WEBSITE_DOMAIN}/jobs">
    <meta property="og:type" content="website">
    <meta property="og:image" content="https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/public-assets/brand-assets/og_image_url-1762066576271.png">
    <meta property="og:site_name" content="Workly India - Workly India">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Workly India Jobs India - ${jobsList.length}+ Remote Opportunities">
    <meta name="twitter:description" content="Browse verified remote job opportunities in India from trusted employers">
    <meta name="twitter:site" content="@WorklyIndia">
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="/favicon.png">
    
    <!-- Structured Data -->
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    
    <!-- Organization Schema -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Workly India - Workly India",
        "url": "${WEBSITE_DOMAIN}",
        "logo": "https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/public-assets/brand-assets/og_image_url-1762066576271.png",
        "description": "India's trusted platform for verified Workly India jobs. 100% FREE for job seekers. Government registered (MSME/UDYAM-GJ-18-0022888).",
        "foundingDate": "2024",
        "founder": {
            "@type": "Person",
            "name": "Vishalbhai Muljibhai Gohil"
        },
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Sankhewsar",
            "addressLocality": "Patan",
            "addressRegion": "Gujarat",
            "postalCode": "384246",
            "addressCountry": "IN"
        },
        "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+91-9904923067",
            "contactType": "customer service",
            "availableLanguage": ["English", "Hindi", "Gujarati"]
        },
        "sameAs": [
            "${BRAND_CONFIG.socialLinks.instagram}",
            "${BRAND_CONFIG.socialLinks.youtube}",
            "${BRAND_CONFIG.socialLinks.telegram}",
            "${BRAND_CONFIG.socialLinks.twitter}",
            "${BRAND_CONFIG.socialLinks.facebook}"
        ],
        "taxID": "UDYAM-GJ-18-0022888"
    }
    </script>
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f23; color: #e0e0e0; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 20px; text-align: center; border-bottom: 1px solid #333; }
        h1 { font-size: 2rem; color: #fff; margin-bottom: 10px; }
        .subtitle { color: #a0a0a0; font-size: 1.1rem; }
        .trust-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin: 20px 0; }
        .badge { background: rgba(139,92,246,0.1); border: 1px solid #8b5cf6; padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; color: #a78bfa; }
        .badge-green { background: rgba(34,197,94,0.1); border-color: #22c55e; color: #4ade80; }
        .stats { display: flex; justify-content: center; gap: 30px; margin: 20px 0; flex-wrap: wrap; }
        .stat { text-align: center; }
        .stat-number { font-size: 1.5rem; font-weight: bold; color: #8b5cf6; }
        .stat-label { font-size: 0.85rem; color: #888; }
        .verification-box { background: rgba(34,197,94,0.1); border: 2px solid #22c55e; border-radius: 12px; padding: 20px; margin: 20px auto; max-width: 800px; text-align: left; }
        .verification-box h3 { color: #4ade80; margin-bottom: 10px; }
        .verification-box ul { list-style: none; }
        .verification-box li { padding: 5px 0; color: #a0a0a0; }
        .verification-box a { color: #4ade80; }
        .job-list { display: grid; gap: 20px; margin: 30px 0; }
        .job-card { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 20px; transition: border-color 0.3s; }
        .job-card:hover { border-color: #8b5cf6; }
        .job-header { display: flex; gap: 15px; margin-bottom: 15px; }
        .company-logo { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #333; }
        .job-info { flex: 1; }
        .job-title { font-size: 1.2rem; color: #fff; margin-bottom: 5px; }
        .job-title a { color: inherit; text-decoration: none; }
        .job-title a:hover { color: #8b5cf6; }
        .company-name { color: #8b5cf6; font-size: 0.95rem; }
        .company-name a { color: inherit; text-decoration: none; }
        .verified-badge { background: #22c55e; color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }
        .job-meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
        .meta-item { background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; color: #aaa; }
        .salary { color: #22c55e; font-weight: 600; }
        .job-description { color: #888; font-size: 0.9rem; margin: 10px 0; }
        .job-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .tag { background: rgba(139,92,246,0.1); color: #a78bfa; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; }
        .featured { border-color: #f59e0b; position: relative; }
        .featured::before { content: '⭐ Featured'; background: #f59e0b; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; position: absolute; top: -10px; left: 20px; }
        .trending { border-color: #ef4444; }
        .social-links { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .social-link { color: #8b5cf6; text-decoration: none; font-size: 0.85rem; }
        .apply-btn { display: inline-block; background: #8b5cf6; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 15px; }
        .apply-btn:hover { background: #7c3aed; }
        footer { background: #0a0a1a; padding: 40px 20px; margin-top: 40px; text-align: center; border-top: 1px solid #333; }
        .footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin: 20px 0; }
        .footer-links a { color: #8b5cf6; text-decoration: none; }
        .trust-info { max-width: 700px; margin: 20px auto; color: #888; font-size: 0.9rem; }
        .video-link { color: #ef4444; text-decoration: none; display: inline-block; margin-top: 10px; }
        @media (max-width: 640px) { .job-header { flex-direction: column; } .company-logo { width: 50px; height: 50px; } }
    </style>
</head>
<body>
    <header>
        <h1>🏠 Workly India Jobs India</h1>
        <p class="subtitle">${jobsList.length}+ Verified Remote Job Opportunities from Trusted Employers</p>
        
        <div class="trust-badges">
            <span class="badge badge-green">✅ UDYAM-GJ-18-0022888 Registered</span>
            <span class="badge">🆓 100% FREE for Job Seekers</span>
            <span class="badge">🔒 All Employers Verified</span>
            <span class="badge">📞 +91 9904923067</span>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${jobsList.length}+</div>
                <div class="stat-label">Active Jobs</div>
            </div>
            <div class="stat">
                <div class="stat-number">${uniqueCompanies}+</div>
                <div class="stat-label">Verified Companies</div>
            </div>
            <div class="stat">
                <div class="stat-number">${featuredCount}</div>
                <div class="stat-label">Featured Jobs</div>
            </div>
            <div class="stat">
                <div class="stat-number">${trendingCount}</div>
                <div class="stat-label">Trending Jobs</div>
            </div>
        </div>
        
        <div class="verification-box">
            <h3>✅ THIS PLATFORM IS 100% LEGITIMATE</h3>
            <ul>
                <li>📜 <strong>Government Registration:</strong> UDYAM-GJ-18-0022888 - <a href="https://udyamregistration.gov.in/Udyam_Verify.aspx" target="_blank">Verify Here</a></li>
                <li>👤 <strong>Owner:</strong> Vishalbhai Muljibhai Gohil</li>
                <li>📍 <strong>Address:</strong> Sankhewsar, Patan, Gujarat 384246</li>
                <li>📞 <strong>Contact:</strong> +91 9904923067 (WhatsApp Available)</li>
                <li>📧 <strong>Email:</strong> worklyindia@outlook.com</li>
                <li>💰 <strong>Job Seeker Fee:</strong> ZERO - Always FREE!</li>
            </ul>
        </div>
    </header>
    
    <div class="container">
        <nav style="margin: 20px 0;">
            <a href="${WEBSITE_DOMAIN}" style="color: #8b5cf6;">Home</a> &gt; 
            <span>Jobs</span>
        </nav>
        
        <h2 style="margin: 20px 0; color: #fff;">Latest Workly India Jobs in India</h2>
        
        <div class="job-list">
            ${jobsList.map(job => {
              const jobSlug = job.public_slug || job.id
              const companySlug = job.companies?.slug || job.companies?.id
              const isTrending = job.trending_score && job.trending_score > 0
              const videoUrl = job.video_url || job.video_url_1 || job.video_url_2
              const jobLocation = job.city ? `${job.city}, ${job.state || 'India'}` : (job.location || 'Remote - India')
              const companyLocation = job.companies?.city 
                ? `${job.companies.city}, ${job.companies.state || 'India'}` 
                : (job.companies?.location || 'India')
              
              return `
            <article class="job-card ${job.is_featured ? 'featured' : ''} ${isTrending ? 'trending' : ''}" itemscope itemtype="https://schema.org/JobPosting">
                <meta itemprop="datePosted" content="${job.created_at}">
                <meta itemprop="employmentType" content="${job.job_type || 'FULL_TIME'}">
                
                <div class="job-header">
                    ${job.companies?.logo_url ? `<img src="${job.companies.logo_url}" alt="${job.companies.company_name} logo" class="company-logo" loading="lazy" itemprop="image">` : '<div class="company-logo"></div>'}
                    <div class="job-info">
                        <h3 class="job-title" itemprop="title">
                            <a href="${buildUrl(`/job/${jobSlug}`)}" itemprop="url">${job.title}</a>
                        </h3>
                        <p class="company-name" itemprop="hiringOrganization" itemscope itemtype="https://schema.org/Organization">
                            ${job.companies ? `<a href="${buildUrl(`/company/${companySlug}`)}" itemprop="url"><span itemprop="name">${job.companies.company_name}</span></a>` : '<span>Company</span>'}
                            ${job.companies?.is_verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
                        </p>
                        ${job.companies?.industry ? `<p style="color: #888; font-size: 0.8rem;">Industry: ${job.companies.industry}</p>` : ''}
                    </div>
                </div>
                
                <div class="job-meta">
                    <span class="meta-item salary" itemprop="baseSalary">${formatSalary(job)}</span>
                    <span class="meta-item" itemprop="jobLocation">📍 ${jobLocation}</span>
                    <span class="meta-item">💼 ${job.job_type || 'Full Time'}</span>
                    <span class="meta-item">📅 ${new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    ${job.experience_level ? `<span class="meta-item">🎯 ${job.experience_level}</span>` : ''}
                </div>
                
                ${videoUrl ? `<a href="${videoUrl}" target="_blank" class="video-link">🎥 Watch Job Video</a>` : ''}
                
                <p class="job-description" itemprop="description">${job.description?.substring(0, 300) || 'Apply now for this exciting Workly India opportunity.'}${job.description && job.description.length > 300 ? '...' : ''}</p>
                
                <div class="job-tags">
                    <span class="tag">${job.category || 'General'}</span>
                    ${job.is_featured ? '<span class="tag">⭐ Featured</span>' : ''}
                    ${isTrending ? '<span class="tag">🔥 Trending</span>' : ''}
                </div>
                
                ${job.companies && (job.companies.instagram_link || job.companies.facebook_link || job.companies.linkedin_link || job.companies.youtube_link || job.companies.website) ? `
                <div class="social-links">
                    <span style="color: #888; font-size: 0.85rem;">Company Links:</span>
                    ${job.companies.website ? `<a href="${job.companies.website}" target="_blank" class="social-link">🌐 Website</a>` : ''}
                    ${job.companies.instagram_link ? `<a href="${job.companies.instagram_link}" target="_blank" class="social-link">📸 Instagram</a>` : ''}
                    ${job.companies.facebook_link ? `<a href="${job.companies.facebook_link}" target="_blank" class="social-link">📘 Facebook</a>` : ''}
                    ${job.companies.linkedin_link ? `<a href="${job.companies.linkedin_link}" target="_blank" class="social-link">💼 LinkedIn</a>` : ''}
                    ${job.companies.youtube_link ? `<a href="${job.companies.youtube_link}" target="_blank" class="social-link">🎥 YouTube</a>` : ''}
                </div>
                ` : ''}
                
                <a href="${buildUrl(`/job/${jobSlug}`)}" class="apply-btn">View Job & Apply →</a>
            </article>
            `}).join('')}
        </div>
    </div>
    
    <footer>
        <h3 style="color: #fff; margin-bottom: 15px;">About Workly India</h3>
        <p class="trust-info">
            Workly India is India's trusted platform for verified Workly India jobs. We are a government registered company 
            (<strong>UDYAM-GJ-18-0022888</strong>) providing <strong>100% FREE</strong> job search services to job seekers. 
            All employers on our platform are verified via GST/PAN documentation to ensure genuine opportunities.
            <br><br>
            <strong>Owner:</strong> Vishalbhai Muljibhai Gohil | <strong>Contact:</strong> +91 9904923067 | <strong>Email:</strong> worklyindia@outlook.com
        </p>
        
        <div class="footer-links">
            <a href="${WEBSITE_DOMAIN}">🏠 Home</a>
            <a href="${buildUrl('/jobs')}">💼 All Jobs</a>
            <a href="${buildUrl('/company-directory')}">🏢 Companies</a>
            <a href="${buildUrl('/about-us')}">ℹ️ About Us</a>
            <a href="${buildUrl('/contact-us')}">📞 Contact</a>
            <a href="${buildUrl('/faq')}">❓ FAQ</a>
            <a href="${buildUrl('/privacy')}">🔒 Privacy</a>
            <a href="${buildUrl('/terms-conditions')}">📜 Terms</a>
        </div>
        
        <div style="margin: 20px 0;">
            <p style="color: #888; font-size: 0.9rem;">Follow Us:</p>
            <div class="footer-links">
                <a href="https://www.instagram.com/official.Workly India.india" target="_blank">📸 Instagram</a>
                <a href="https://youtube.com/@wfh_india" target="_blank">🎥 YouTube</a>
                <a href="https://t.me/OFFICIAl_WFH_INDIA" target="_blank">💬 Telegram</a>
                <a href="https://x.com/WFHindia" target="_blank">🐦 Twitter</a>
                <a href="https://www.facebook.com/share/1H4Fxqwttx/" target="_blank">📘 Facebook</a>
            </div>
        </div>
        
        <p style="color: #666; font-size: 0.8rem; margin-top: 20px;">
            © 2024-${new Date().getFullYear()} Workly India (Workly India). All rights reserved.<br>
            MSME Registered: UDYAM-GJ-18-0022888 | IEC: EBGPG4522J
        </p>
    </footer>
</body>
</html>`

    return new Response(html, { 
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    })
  } catch (error) {
    console.error('Error in seo-jobs-list:', error)
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head><title>Error - Workly India</title></head>
<body>
<h1>Error loading jobs</h1>
<p>Please visit <a href="${WEBSITE_DOMAIN}">${WEBSITE_DOMAIN}</a> directly.</p>
<p>Contact: +91 9904923067 | worklyindia@outlook.com</p>
</body>
</html>`, { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
})
