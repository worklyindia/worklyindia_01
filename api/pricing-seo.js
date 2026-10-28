import { fetchPublicPricing, pricingSections, pricingSchema, formatPrice, PRICING_TITLE, PRICING_DESCRIPTION } from '../src/lib/publicPricing.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function renderPricingHtml(shell, sections, url) {
  const content = `<main id="public-pricing"><header><a href="/more" aria-label="Back">← Back</a><h1>Workly India Website Pricing</h1></header><p>Current plans and prices in Indian rupees (INR).</p><nav>${sections.map((s) => `<a href="#${s.id}">${esc(s.name)}</a>`).join(' · ')}</nav>${sections.map((s) => `<section id="${s.id}"><h2>${esc(s.name)}</h2><p>${esc(s.note)}</p>${s.plans.map((p) => `<article><h3>${esc(p.name)}</h3><p><strong>${esc(p.price !== null ? formatPrice(p.price) : p.priceLabel)}</strong> ${esc(p.unit)}</p><ul>${p.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></article>`).join('')}${!s.plans.length ? '<p>No fixed active packages available.</p>' : ''}<a href="${esc(s.target)}">View service</a></section>`).join('')}<footer><p>Any applicable taxes and final payable amounts are confirmed at checkout.</p><a href="/contact-us">Contact Us</a> · <a href="/refund-policy">Refund &amp; Cancellation</a></footer></main>`;
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(PRICING_TITLE)}</title>`)
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:title|og:description|og:url|og:type|twitter:title|twitter:description|twitter:card)["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace('</head>', `<meta name="description" content="${esc(PRICING_DESCRIPTION)}"><meta property="og:title" content="${esc(PRICING_TITLE)}"><meta property="og:description" content="${esc(PRICING_DESCRIPTION)}"><meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}"><meta name="twitter:card" content="summary"><link rel="canonical" href="${esc(url)}"><script type="application/ld+json">${JSON.stringify(pricingSchema(sections,url)).replace(/</g,'\\u003c')}</script><style>#public-pricing{max-width:1100px;margin:auto;padding:24px;font-family:system-ui;line-height:1.6}#public-pricing section{border-bottom:1px solid;padding:24px 0}#public-pricing article{display:inline-block;vertical-align:top;min-width:220px;max-width:100%;margin:8px 24px 8px 0}#public-pricing nav a{display:inline-block;margin:4px 8px 4px 0}</style></head>`);
  // React replaces this root with the interactive page. The initial response is complete even without JavaScript.
  return html.replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${content}</div>`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const data = await fetchPublicPricing(AbortSignal.timeout(10000));
    const sections = pricingSections(data);
    if (req.query.format === 'json') {
      res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify({ currency: 'INR', checked_at: new Date().toISOString(), sections }));
    }
    // Read the bundled shell: deployment URLs may return Vercel's authentication page.
    const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:8080';
    const shell = await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8');
    if (!/<div\b[^>]*id=["']root["']/.test(shell)) throw new Error('Website shell unavailable');
    const canonical = shell.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["'](https:\/\/[^"']+)/i)?.[1];
    const url = `${canonical ? new URL(canonical).origin : origin}/pricing`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send(renderPricingHtml(shell, sections, url));
  } catch {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(503).send('<!doctype html><html><head><title>Pricing temporarily unavailable | Workly India</title><meta name="robots" content="noindex"></head><body><h1>Pricing temporarily unavailable</h1><p>Please try again shortly.</p><a href="/pricing">Retry</a></body></html>');
  }
}