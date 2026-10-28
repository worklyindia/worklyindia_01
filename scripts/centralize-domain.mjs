/**
 * One-off codemod: replace hardcoded canonical-domain literals with references
 * to the central domain config.
 *
 * Run with --dry to preview.
 *
 *   node scripts/centralize-domain.mjs --dry
 *   node scripts/centralize-domain.mjs
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, relative, dirname, sep } from 'node:path';

const root = process.cwd();
const DRY = process.argv.includes('--dry');
const LEGACY = 'worklyindia.devs.surf';
const LEGACY_URL = `https://${LEGACY}`;

const SKIP = new Set([
  'src/config/domainConfig.ts',
  'supabase/functions/_shared/domain.ts',
]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...(await walk(p)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Replace the legacy domain inside quoted string literals only, converting the
 * literal to a template literal that interpolates the central constant.
 * JSX text, comments and other bare occurrences are left untouched and reported.
 */
function transform(source, { urlConst, domainConst }) {
  let used = new Set();
  let out = source;

  // 1) Whole-string exact URL match -> bare constant.
  out = out.replace(
    new RegExp(`(['"\`])${LEGACY_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g'),
    () => {
      used.add(urlConst);
      return urlConst;
    }
  );

  // 2) Whole-string exact bare domain -> bare constant.
  out = out.replace(
    new RegExp(`(['"\`])${LEGACY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g'),
    () => {
      used.add(domainConst);
      return domainConst;
    }
  );

  // 3) Single/double quoted strings that CONTAIN the domain -> template literal.
  out = out.replace(/(['"])((?:\\.|(?!\1)[^\\\r\n])*)\1/g, (whole, q, body) => {
    if (!body.includes(LEGACY)) return whole;
    if (body.includes('`') || body.includes('${')) return whole; // unsafe to convert
    let next = body
      .split(LEGACY_URL).join(`\${${urlConst}}`)
      .split(LEGACY).join(`\${${domainConst}}`);
    if (next.includes(`\${${urlConst}}`)) used.add(urlConst);
    if (next.includes(`\${${domainConst}}`)) used.add(domainConst);
    return '`' + next + '`';
  });

  // 4) Existing template literals that contain the domain.
  out = out.replace(/`(?:\\.|[^\\`])*`/g, (whole) => {
    if (!whole.includes(LEGACY)) return whole;
    let next = whole
      .split(LEGACY_URL).join(`\${${urlConst}}`)
      .split(LEGACY).join(`\${${domainConst}}`);
    if (next.includes(`\${${urlConst}}`)) used.add(urlConst);
    if (next.includes(`\${${domainConst}}`)) used.add(domainConst);
    return next;
  });

  return { out, used };
}

function addImport(source, names, importPath) {
  const list = [...names].sort();
  if (!list.length) return source;

  // Reuse an existing import from the same module if present.
  const existing = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*(['"])${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\2;?`
  );
  const m = source.match(existing);
  if (m) {
    const have = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const merged = [...new Set([...have, ...list])].sort();
    return source.replace(existing, `import { ${merged.join(', ')} } from '${importPath}';`);
  }

  const stmt = `import { ${list.join(', ')} } from '${importPath}';\n`;

  // Insert after the last top-level import, else at the very top (after any
  // leading comment/directive block).
  const importRe = /^import[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*$/gm;
  let last = null;
  let mm;
  while ((mm = importRe.exec(source))) last = mm;
  if (last) {
    const idx = last.index + last[0].length;
    return source.slice(0, idx) + '\n' + stmt.trimEnd() + source.slice(idx);
  }
  return stmt + source;
}

const srcFiles = await walk(join(root, 'src'));
const fnFiles = await walk(join(root, 'supabase/functions'));

let changed = 0;
const leftovers = [];

for (const file of [...srcFiles, ...fnFiles]) {
  const rel = relative(root, file).split(sep).join('/');
  if (SKIP.has(rel)) continue;

  const original = await readFile(file, 'utf8');
  if (!original.includes(LEGACY)) continue;

  const isFn = rel.startsWith('supabase/functions/');
  const urlConst = isFn ? 'WEBSITE_DOMAIN' : 'CANONICAL_URL';
  const domainConst = 'CANONICAL_DOMAIN';

  let importPath;
  if (isFn) {
    const fromDir = dirname(rel);
    let p = relative(fromDir, 'supabase/functions/_shared/domain.ts').split(sep).join('/');
    if (!p.startsWith('.')) p = './' + p;
    importPath = p;
  } else {
    importPath = '@/config/domainConfig';
  }

  const { out, used } = transform(original, { urlConst, domainConst });
  let next = addImport(out, used, importPath);

  if (next !== original) {
    changed++;
    if (!DRY) await writeFile(file, next);
  }

  if (next.includes(LEGACY)) {
    const lines = next.split('\n');
    lines.forEach((l, i) => {
      if (l.includes(LEGACY)) leftovers.push(`${rel}:${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
}

console.log(`${DRY ? '[dry-run] ' : ''}files changed: ${changed}`);
console.log(`remaining hardcoded occurrences: ${leftovers.length}`);
for (const l of leftovers) console.log('  ' + l);
