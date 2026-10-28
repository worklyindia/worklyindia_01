/**
 * Repair pass: the centralize-domain codemod replaced quoted JSX attribute
 * values with bare identifiers / template literals, which JSX does not allow.
 * Wrap those values in braces.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const CONSTS = 'CANONICAL_URL|CANONICAL_DOMAIN|WEBSITE_DOMAIN';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      out.push(...(await walk(p)));
    } else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of await walk(join(root, 'src'))) {
  const original = await readFile(file, 'utf8');
  let next = original;

  // attr=CONST  ->  attr={CONST}
  next = next.replace(
    new RegExp(`(\\s[A-Za-z_][\\w:-]*)=(${CONSTS})(?=[\\s/>])`, 'g'),
    '$1={$2}'
  );

  // attr=`...${CONST}...`  ->  attr={`...`}
  next = next.replace(
    /(\s[A-Za-z_][\w:-]*)=(`(?:\\.|[^\\`])*`)/g,
    (whole, attr, tpl) => (tpl.includes('${') ? `${attr}={${tpl}}` : whole)
  );

  if (next !== original) {
    await writeFile(file, next);
    changed++;
    console.log('fixed', relative(root, file).split(sep).join('/'));
  }
}
console.log(`\n${changed} file(s) repaired`);
