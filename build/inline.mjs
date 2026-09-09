/**
 * Post-build step: fold dist/index.html + delve.js + delve.css into ONE
 * self-contained file at dist/delve.html.
 *
 * Uses only Node built-ins on purpose - the shipped game must have zero
 * runtime dependencies, and we keep the toolchain dependency-light too.
 */
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const htmlPath = join(dist, 'index.html');
if (!existsSync(htmlPath)) {
  console.error('[inline] dist/index.html not found - run `vite build` first.');
  process.exit(1);
}

let html = await readFile(htmlPath, 'utf8');

// Replace <script src="...delve.js"> with the bundle itself.
html = await replaceAsync(
  html,
  /<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*><\/script>/g,
  async (_match, src) => {
    const code = await readFile(join(dist, basename(src)), 'utf8');
    return `<script type="module">\n${code}\n</script>`;
  },
);

// Replace <link rel="stylesheet" href="...delve.css"> with the stylesheet.
html = await replaceAsync(
  html,
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+\.css)["'][^>]*>/g,
  async (_match, href) => {
    const css = await readFile(join(dist, basename(href)), 'utf8');
    return `<style>\n${css}\n</style>`;
  },
);

const outPath = join(dist, 'delve.html');
await writeFile(outPath, html, 'utf8');

// Drop the now-redundant loose assets so dist/ holds exactly one artifact.
for (const name of await readdir(dist)) {
  if (name !== 'delve.html') await rm(join(dist, name), { recursive: true, force: true });
}

const bytes = Buffer.byteLength(html, 'utf8');
console.log(`[inline] dist/delve.html  ${(bytes / 1024).toFixed(1)} kB  (self-contained)`);

// --- helpers ---------------------------------------------------------------

function basename(p) {
  return p.split('/').pop();
}

async function replaceAsync(input, regex, replacer) {
  const jobs = [];
  input.replace(regex, (...args) => {
    jobs.push(replacer(...args));
    return '';
  });
  const resolved = await Promise.all(jobs);
  let i = 0;
  return input.replace(regex, () => resolved[i++]);
}
