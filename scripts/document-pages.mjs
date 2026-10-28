import fs from 'node:fs';

export function readDocumentCatalog() {
  return [...fs.readFileSync('src/components/docs/documentCatalog.ts', 'utf8').matchAll(/\["(\/(?:developers|api-docs)\/[^" ]+)", "([^"]+)", "([^"]+)"\]/g)]
    .map(([, route, slug, title]) => ({ route, slug, title }));
}
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderDocumentHtml(template, doc, text) {
  const domain = fs.readFileSync('src/config/domainConfig.ts', 'utf8').match(/DEFAULT_CANONICAL_DOMAIN\s*=\s*'([^']+)'/)?.[1];
  if (!domain) throw new Error('Missing documentation canonical domain');
  const url = `https://${domain}${doc.route}`;
  const title = escapeHtml(`${doc.title} | Workly India Developers`);
  const description = escapeHtml(`${doc.title}: developer setup, API examples, permissions and troubleshooting.`);
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/<!-- Comprehensive Noscript Content[\s\S]*?<\/noscript>/i, '');
  html = html.replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:title|og:description|og:url|twitter:title|twitter:description)["'][^>]*>/gi, '');
  html = html.replace('</head>', `<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<link rel="canonical" href="${url}" />
<link rel="alternate" type="text/plain" href="/docs/${doc.slug}.txt" />
</head>`);
  // Identical HTML for people and crawlers; React mounts the interactive guide.
  return html.replace('<div id="root"></div>', `<div id="root"><noscript><main><h1>${title}</h1><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(text)}</pre></main></noscript></div>`);
}

export function documentPagesPlugin() {
  return {
    name: 'public-document-pages', apply: 'build', enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') throw new Error('Missing index.html for documentation export');
      for (const doc of readDocumentCatalog()) {
        const text = fs.readFileSync(`public/docs/${doc.slug}.txt`, 'utf8');
        if (!text.trim()) throw new Error(`Empty public document: ${doc.slug}`);
        this.emitFile({ type: 'asset', fileName: `document-pages/${doc.slug}.html`, source: renderDocumentHtml(String(index.source), doc, text) });
      }
    },
  };
}