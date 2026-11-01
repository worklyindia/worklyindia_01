import fs from 'node:fs';
import { readDocumentCatalog, renderDocumentHtml } from './document-pages.mjs';
import { PUBLIC_CAREER_CONTENT } from '../src/lib/publicCareerContent.mjs';
import { FOUNDER_NAME, founderSchema } from '../src/lib/founderProfile.mjs';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Reads the same registry RouteSEO uses so crawler HTML and the live page never disagree.
export function readRouteSeo() {
  const src = fs.readFileSync('src/lib/routeSeo.ts', 'utf8');
  const out = [];
  for (const m of src.matchAll(/^\s*"(\/[^"]*)":\s*\{\s*title:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*keywords:\s*"([^"]*)"(?:,\s*type:\s*"(\w+)")?/gm)) {
    out.push({ route: m[1], title: m[2], description: m[3], keywords: m[4], type: m[5] || 'WebPage' });
  }
  return out;
}

export function renderRouteHtml(template, domain, e) {
  const url = `https://${domain}${e.route === '/' ? '/' : e.route}`;
  const schema = { '@context': 'https://schema.org', '@type': e.type, name: e.title, description: e.description, url, inLanguage: 'en-IN', isPartOf: { '@type': 'WebSite', name: 'Workly India', url: `https://${domain}/` } };
  if (e.route === '/about-us') {
    // Static identity stays valid after portrait changes; React supplies the current saved image.
    const { image, ...person } = founderSchema(`https://${domain}`);
    schema.mainEntity = person;
  }
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(e.title)}</title>`);
  html = html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/<meta\b[^>]*(?:name|property)=["'](?:title|description|keywords|og:title|og:description|og:url|twitter:title|twitter:description|twitter:url)["'][^>]*>/gi, '');
  html = html.replace('</head>', `<meta name="description" content="${esc(e.description)}" />
<meta name="keywords" content="${esc(e.keywords)}" />
<meta property="og:title" content="${esc(e.title)}" />
<meta property="og:description" content="${esc(e.description)}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:title" content="${esc(e.title)}" />
<meta name="twitter:description" content="${esc(e.description)}" />
<link rel="canonical" href="${url}" />
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
</head>`);
  const content = PUBLIC_CAREER_CONTENT[e.route];
  if (e.route === '/about-us') {
    html = html.replace(/<!-- Comprehensive Noscript Content[\s\S]*?<\/noscript>/i, '');
    const body = `<noscript><main><h1>About Workly India</h1><section id="founder"><h2>${esc(FOUNDER_NAME)}</h2><p>Founder &amp; CEO, Workly India</p><p>Workly India connects job seekers and employers across India.</p></section><p><a href="/contact-us">Contact Workly India</a></p></main></noscript>`;
    return html.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  }
  if (!content) return html;
  // Replace the generic homepage fallback with the same facts shown in React.
  html = html.replace(/<!-- Comprehensive Noscript Content[\s\S]*?<\/noscript>/i, '');
  const body = `<noscript><main><h1>${esc(content.heading)}</h1><p>${esc(content.description)}</p>${content.sections.map(section => `<section><h2>${esc(section.heading)}</h2><p>${esc(section.text)}</p></section>`).join('')}<nav>${content.links.map(link => `<p><a href="${esc(link.href)}">${esc(link.label)}</a></p>`).join('')}</nav></main></noscript>`;
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
}

// Emits /about-us -> about-us.html etc.; Vercel cleanUrls serves real files before the SPA rewrite.
export function routePagesPlugin() {
  return {
    name: 'public-route-pages', apply: 'build', enforce: 'post',
    generateBundle(_o, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      const template = String(index.source);
      const domain = fs.readFileSync('src/config/domainConfig.ts', 'utf8').match(/DEFAULT_CANONICAL_DOMAIN\s*=\s*'([^']+)'/)?.[1];
      const docRoutes = new Set();
      const seo = new Map(readRouteSeo().map((e) => [e.route, e]));
      for (const doc of readDocumentCatalog()) {
        const text = fs.readFileSync(`public/docs/${doc.slug}.txt`, 'utf8');
        docRoutes.add(doc.route);
        this.emitFile({ type: 'asset', fileName: `${doc.route.slice(1)}.html`, source: seo.has(doc.route) ? renderRouteHtml(renderDocumentHtml(template, doc, text), domain, { ...seo.get(doc.route), type: 'TechArticle' }) : renderDocumentHtml(template, doc, text) });
      }
      for (const e of readRouteSeo()) {
        if (e.route === '/' || e.route === '/pricing' || docRoutes.has(e.route)) continue;
        this.emitFile({ type: 'asset', fileName: `${e.route.slice(1)}.html`, source: renderRouteHtml(template, domain, e) });
      }
    },
  };
}
