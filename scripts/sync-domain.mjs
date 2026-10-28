import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const configPath = join(root, 'src/config/domainConfig.ts');
const config = await readFile(configPath, 'utf8');
const match = config.match(/export const DEFAULT_CANONICAL_DOMAIN\s*=\s*['"]([^'"]+)['"]/);
if (!match) {
  throw new Error('Could not read DEFAULT_CANONICAL_DOMAIN from src/config/domainConfig.ts');
}

const canonicalDomain = match[1];
const canonicalUrl = `https://${canonicalDomain}`;

// -------------------------------------------------------------------
// 1) Propagate the domain to the edge-function constant.
//    src/config/domainConfig.ts is the SINGLE source of truth; the
//    Deno runtime cannot import from src/, so we mirror the value here.
// -------------------------------------------------------------------
const edgeConfigPath = join(root, 'supabase/functions/_shared/domain.ts');
if (existsSync(edgeConfigPath)) {
  const edgeOriginal = await readFile(edgeConfigPath, 'utf8');
  const edgeUpdated = edgeOriginal.replace(
    /(export const CANONICAL_DOMAIN\s*=\s*')[^']+(')/,
    `$1${canonicalDomain}$2`
  );
  if (edgeUpdated !== edgeOriginal) {
    await writeFile(edgeConfigPath, edgeUpdated);
    console.log(`  synced supabase/functions/_shared/domain.ts`);
  }
}

// -------------------------------------------------------------------
// 2) Rewrite static / non-TypeScript assets that cannot import the
//    config (HTML, manifests, native app config, robots, sitemaps).
// -------------------------------------------------------------------
const files = [
  'index.html',
  'capacitor.config.json',
  'capacitor.config.ts',
  'AndroidManifest.xml',
  'WFH-India.entitlements',
  'public',
];

async function collect(path) {
  const stat = await import('node:fs/promises').then(({ stat }) => stat(path));
  if (stat.isDirectory()) {
    const entries = await import('node:fs/promises').then(({ readdir }) => readdir(path, { withFileTypes: true }));
    return (await Promise.all(entries.map((entry) => collect(join(path, entry.name))))).flat();
  }
  return [path];
}

const targets = (await Promise.all(files.map((file) => collect(join(root, file))))).flat();

// Any previously-used domain that may still be baked into static assets.
const knownDomains = [
  'worklyindia.devs.surf',
  'wfhindia.co.in',
  'worklyindia.com',
  'testdomain.example',
  'workly-india.vercel.app',
];

let touched = 0;
await Promise.all(targets.map(async (file) => {
  if (!existsSync(file)) return;
  if (/\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|mp4|zip)$/i.test(file)) return;
  const original = await readFile(file, 'utf8');
  let updated = original;
  for (const legacy of knownDomains) {
    if (legacy === canonicalDomain) continue;
    updated = updated
      .replaceAll(`https://${legacy}`, canonicalUrl)
      .replaceAll(legacy, canonicalDomain);
  }
  if (updated !== original) {
    await writeFile(file, updated);
    touched++;
  }
}));

console.log(`Domain sync complete: ${canonicalUrl} (${touched} static file${touched === 1 ? '' : 's'} updated)`);
