#!/usr/bin/env node
/**
 * Generates the dynamic sitemap files in public/ from live Supabase data:
 *   dynamic-jobs-sitemap.xml, dynamic-blog-sitemap.xml,
 *   dynamic-companies-sitemap.xml, image-sitemap.xml, dynamic-sitemap.xml
 *
 * Domain comes from scripts/sync-domain.mjs config (CANONICAL domain).
 * Run: node scripts/generate-dynamic-sitemaps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DOMAIN = process.env.CANONICAL_DOMAIN || 'worklyindia.devs.surf';
const BASE = `https://${DOMAIN}`;
// Publishable (public) key fallback so every build refreshes job URLs even without .env.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jubwzelupbntbetpajqb.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[sitemaps] Missing Supabase env; keeping existing sitemap files');
  process.exit(0);
}

const publicDir = path.join(process.cwd(), 'public');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);

async function q(pathWithQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathWithQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) {
    console.warn(`[warn] query failed (${res.status}): ${pathWithQuery}`);
    return [];
  }
  return res.json();
}

function urlset(entries) {
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${esc(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}` +
        `\n    <changefreq>${e.changefreq || 'weekly'}</changefreq>\n    <priority>${e.priority || '0.7'}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function write(name, xml, count = 1) {
  if (count === 0) { console.warn(`[sitemaps] ${name}: no rows, keeping existing file`); return; }
  fs.writeFileSync(path.join(publicDir, name), xml);
  console.log(`✓ ${name}`);
}

const [jobs, blogs, companies, images] = await Promise.all([
  q('jobs?select=id,updated_at,created_at,title&status=eq.active&order=created_at.desc&limit=5000'),
  q('blog_posts?select=slug,updated_at,created_at,title&order=created_at.desc&limit=2000'),
  q('companies?select=id,updated_at,created_at,company_name&order=created_at.desc&limit=5000'),
  q('job_images?select=job_id,image_url,created_at&limit=5000'),
]);

write(
  'dynamic-jobs-sitemap.xml',
  urlset(jobs.map((j) => ({ loc: `${BASE}/job/${j.id}`, lastmod: day(j.updated_at || j.created_at), changefreq: 'daily', priority: '0.9' })))
);

write(
  'dynamic-blog-sitemap.xml',
  urlset(blogs.map((b) => ({ loc: `${BASE}/blog/${b.slug}`, lastmod: day(b.updated_at || b.created_at), changefreq: 'weekly', priority: '0.7' })))
);

write(
  'dynamic-companies-sitemap.xml',
  urlset(companies.map((c) => ({ loc: `${BASE}/company/${c.id}`, lastmod: day(c.updated_at || c.created_at), changefreq: 'weekly', priority: '0.6' })))
);

// Image sitemap: job pages with their images
const byJob = new Map();
for (const img of images) {
  if (!img.image_url) continue;
  if (!byJob.has(img.job_id)) byJob.set(img.job_id, []);
  byJob.get(img.job_id).push(img.image_url);
}
const imageEntries = [...byJob.entries()]
  .map(
    ([jobId, urls]) =>
      `  <url>\n    <loc>${esc(`${BASE}/job/${jobId}`)}</loc>\n` +
      urls.map((u) => `    <image:image>\n      <image:loc>${esc(u)}</image:loc>\n    </image:image>`).join('\n') +
      `\n  </url>`
  )
  .join('\n');
write(
  'image-sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${
    imageEntries
  }\n</urlset>\n`,
  imageEntries ? 1 : 0
);

// dynamic-sitemap.xml = index of the dynamic sitemaps above
write(
  'dynamic-sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    ['dynamic-jobs-sitemap.xml', 'dynamic-blog-sitemap.xml', 'dynamic-companies-sitemap.xml', 'image-sitemap.xml']
      .map((f) => `  <sitemap>\n    <loc>${BASE}/${f}</loc>\n  </sitemap>`)
      .join('\n') +
    `\n</sitemapindex>\n`
);

console.log(`Done for ${BASE} — jobs:${jobs.length} blogs:${blogs.length} companies:${companies.length} images:${images.length}`);
