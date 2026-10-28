// Serves /job/:id with job-specific head tags + JobPosting schema so every new job gets its own Google result.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const SUPABASE_URL = 'https://jubwzelupbntbetpajqb.supabase.co';
const KEY = 'sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (t) => String(t ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function findJob(id) {
  const cols = 'id,title,description,location,city,state,precise_address,job_type,work_mode,category,salary_min,salary_max,salary_period,salary_currency,created_at,expires_at,application_deadline,status,companies(company_name,logo_url,postal_code,state,precise_address)';
  for (const field of UUID.test(id) ? ['id'] : ['public_slug', 'short_id']) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=${cols}&${field}=eq.${encodeURIComponent(id)}&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) continue;
    const rows = await r.json();
    if (rows[0]) return rows[0];
  }
  return null;
}

// Google only accepts its own enum values; unknown types are omitted rather than guessed.
const TYPES = { 'full time': 'FULL_TIME', 'part time': 'PART_TIME', contract: 'CONTRACTOR', contractor: 'CONTRACTOR', temporary: 'TEMPORARY', internship: 'INTERN', intern: 'INTERN', freelance: 'CONTRACTOR', volunteer: 'VOLUNTEER', 'per diem': 'PER_DIEM' };
const employmentType = (t) => TYPES[String(t || '').toLowerCase().replace(/[-_]+/g, ' ').trim()];
const unit = (p) => ({ hour: 'HOUR', hourly: 'HOUR', day: 'DAY', daily: 'DAY', week: 'WEEK', weekly: 'WEEK', month: 'MONTH', monthly: 'MONTH', year: 'YEAR', yearly: 'YEAR', annual: 'YEAR', annually: 'YEAR' })[String(p || 'month').toLowerCase()] || 'MONTH';

export default async function handler(req, res) {
  const id = String(req.query.id || '').slice(0, 120);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let shell;
  try {
    shell = await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8');
    if (!/<div\b[^>]*id=["']root["']/.test(shell)) throw new Error('Website shell unavailable');
  } catch {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send('<!doctype html><html><head><title>Job temporarily unavailable | Workly India</title><meta name="robots" content="noindex"></head><body><h1>Job temporarily unavailable</h1><p>Please try again shortly.</p></body></html>');
  }
  let job = null;
  try { job = id ? await findJob(id) : null; } catch { job = null; }
  const expired = job && (job.status !== 'active' || (job.expires_at && new Date(job.expires_at) < new Date()));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!job || expired) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(job ? 410 : 404).send(shell.replace('</head>', '<meta name="robots" content="noindex" />\n</head>'));
    return;
  }
  const company = job.companies?.company_name || 'Workly India Employer';
  const url = `https://${host}/job/${id}`;
  const loc = job.location || 'India';
  const parts = loc.split(',').map((p) => p.trim());
  const city = job.city || parts[0] || 'India';
  const state = job.state || parts[1] || job.companies?.state || 'Gujarat';
  const street = job.precise_address || job.companies?.precise_address || `${city}, ${state}`;
  const pin = job.companies?.postal_code || String(street).match(/\b\d{6}\b/)?.[0] || '110001';
  job.expires_at = job.expires_at || new Date(new Date(job.created_at || Date.now()).getTime() + 90 * 864e5).toISOString();
  const salary = job.salary_min ? ` | ₹${job.salary_min}${job.salary_max ? '-' + job.salary_max : ''}` : '';
  const title = `${job.title} Job at ${company} in ${loc}${salary} | Workly India`;
  const desc = `${job.title} at ${company}, ${loc}. ${job.job_type || ''} ${job.work_mode || ''} job. ${strip(job.description)}`.replace(/\s+/g, ' ').slice(0, 158);
  const schema = {
    '@context': 'https://schema.org', '@type': 'JobPosting', title: job.title, description: strip(job.description) || job.title,
    datePosted: job.created_at, validThrough: job.expires_at || job.application_deadline || undefined,
    employmentType: employmentType(job.job_type),
    hiringOrganization: { '@type': 'Organization', name: company, logo: job.companies?.logo_url || undefined },
    ...(String(job.work_mode || '').toLowerCase().includes('remote') ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'India' } } : {}),
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressRegion: state, postalCode: pin, addressCountry: 'IN' } },
    ...(job.salary_min ? { baseSalary: { '@type': 'MonetaryAmount', currency: job.salary_currency || 'INR', value: { '@type': 'QuantitativeValue', value: Math.round((job.salary_min + (job.salary_max || job.salary_min)) / 2), minValue: job.salary_min, maxValue: job.salary_max || job.salary_min, unitText: unit(job.salary_period) } } } : {}),
    url,
  };
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:title|description|keywords|og:title|og:description|og:url|og:type|twitter:title|twitter:description|twitter:url)["'][^>]*>/gi, '');
  html = html.replace('</head>', `<meta name="description" content="${esc(desc)}" />
<meta name="keywords" content="${esc(`${job.title} job, ${job.title} job ${loc}, ${company} jobs, ${job.category || 'jobs'} india`)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
</head>`);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(html);
}
