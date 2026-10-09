// Smoke test for the cinematic demos.
// Usage: node smoke.mjs [baseUrl]   (default http://localhost:8765/cinematic)
// Start the server first: python3 -m http.server 8765  (run from the project root)
//
// Checks, per demo page:
//  1. the page returns HTTP 200
//  2. every local asset it references (script/link/img src, href, ES imports) returns 200,
//     followed recursively through local .js modules
// Fails (exit 1) on any 4xx/5xx or missing local file. Writes SMOKE.md next to this file.
//
// Not covered: browser console errors and runtime exceptions. That needs headless Brave
// with a CDP client (puppeteer-core is not installed in the QA workspace yet).
// Remote CDN URLs (three.js, fonts) are not fetched.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Server runs from the project root (folder that holds index.html and cinematic/): pages live under /cinematic.
const BASE = process.argv[2] || 'http://localhost:8765/cinematic';
const ORIGIN = new URL(BASE).origin;
const BASEPATH = new URL(BASE).pathname.replace(/\/$/, '');
const HERE = dirname(fileURLToPath(import.meta.url));

// Demo pages. Presence and Reggie have no page yet, so they are listed as skipped.
const PAGES = [
  { name: 'site-root', path: '/' , abs: true },
  { name: 'index', path: '/index.html' },
  { name: 'career-demo', path: '/career-demo.html' },
  { name: 'study-demo', path: '/world3d/study/study-demo.html' },
  { name: 'room-clay', path: '/world3d/room-clay.html' },
  { name: 'tower-spike', path: '/tower/index.html' },
  { name: 'room-demo', path: '/world3d/room-demo.html' },
  { name: 'char-demo', path: '/world3d/char-demo.html' },
  { name: 'presence-demo', path: '/world3d/study/presence-demo.html' },
  { name: 'reggie-demo', path: '/world3d/study/reggie-demo.html' },
];

// Local means a relative or root path. Bare specifiers ("three") resolve through the importmap, checked separately.
const isLocal = (ref) => ref && (ref.startsWith('./') || ref.startsWith('../') || ref.startsWith('/')) && !ref.startsWith('//');

function refsFromHtml(html) {
  const out = [];
  const re = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function refsFromJs(js) {
  const out = [];
  // drop comments first so doc examples do not count as imports
  js = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  const re = /(?:import\s+(?:[^'"()]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|import\s*\()\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(js))) out.push(m[1]);
  return out;
}

// Resolve a reference against the file that contains it, as a URL path.
function resolveRef(fromPath, ref, baseHref) {
  // fromPath is a site-absolute path; an HTML <base href> changes where its refs resolve from
  const from = new URL(baseHref ? new URL(baseHref, new URL(fromPath, ORIGIN)).href : fromPath, ORIGIN);
  const u = new URL(ref, from);
  return u.pathname + u.search;
}

async function check(urlPath) {
  const res = await fetch(ORIGIN + urlPath);
  const text = res.ok ? await res.text() : '';
  return { status: res.status, text };
}

async function smokePage(page) {
  const problems = [];
  const seen = new Set();
  page = { ...page, path: page.abs ? page.path : BASEPATH + page.path };
  const root = await check(page.path);
  const baseHref = (root.text.match(/<base\s+href=["']([^"']+)["']/i) || [])[1];
  if (root.status !== 200) return { ...page, ok: false, problems: [`${page.path} -> ${root.status}`] };

  // queue of [pathOfFile, text, isHtml]
  const queue = [[page.path, root.text, true]];
  // importmap values are local files too
  const im = root.text.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  if (im) {
    try { for (const v of Object.values(JSON.parse(im[1]).imports || {})) if (isLocal(v)) queue.push([page.path, `<link href="${v}">`, true]); } catch {}
  }
  while (queue.length) {
    const [filePath, text, isHtml] = queue.shift();
    // HTML: attribute refs plus imports inside inline <script> blocks
    const inline = isHtml ? [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n') : '';
    const refs = (isHtml ? [...refsFromHtml(text), ...refsFromJs(inline)] : refsFromJs(text)).filter(isLocal);
    for (const ref of refs) {
      const target = resolveRef(filePath, ref, isHtml ? baseHref : null).split('?')[0];
      if (seen.has(target)) continue;
      seen.add(target);
      const r = await check(target);
      if (r.status !== 200) {
        problems.push(`${target} (from ${filePath}) -> ${r.status}`);
        continue;
      }
      if (target.endsWith('.js') || target.endsWith('.mjs')) queue.push([target, r.text, false]);
    }
  }
  return { ...page, ok: problems.length === 0, problems, assets: seen.size };
}

const results = [];
for (const page of PAGES) {
  if (!page.path) {
    results.push({ ...page, ok: null, problems: [], assets: 0 });
    continue;
  }
  try {
    results.push(await smokePage(page));
  } catch (err) {
    results.push({ ...page, ok: false, problems: [`request failed: ${err.message}`], assets: 0 });
  }
}

const lines = [];
lines.push('# Cinematic smoke test', '');
lines.push(`Base: ${BASE}  `);
lines.push(`Run: ${new Date().toISOString()}`, '');
lines.push('| Page | Path | Result | Local assets checked | Notes |', '| --- | --- | --- | --- | --- |');
for (const r of results) {
  const status = r.ok === null ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
  const notes = r.ok === null ? r.note : r.problems.length ? r.problems.join('; ') : '';
  lines.push(`| ${r.name} | ${r.path ?? '-'} | ${status} | ${r.assets ?? 0} | ${notes} |`);
}
lines.push('', 'Not checked: console errors, runtime exceptions, remote CDN URLs, real GPU behaviour.', '');

const md = lines.join('\n');
await writeFile(join(HERE, 'SMOKE.md'), md);
console.log(md);

const failed = results.filter((r) => r.ok === false);
process.exit(failed.length ? 1 : 0);
