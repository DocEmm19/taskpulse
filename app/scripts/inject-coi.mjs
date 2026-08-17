#!/usr/bin/env node
/**
 * Task 15: post-export step for `expo export -p web`.
 *
 * GitHub Pages cannot set custom HTTP response headers, but expo-sqlite's web
 * build (wa-sqlite/WASM) needs `window.crossOriginIsolated === true` (for
 * SharedArrayBuffer). The fix is the well-known `coi-serviceworker` script
 * (gzuidhof/coi-serviceworker, MIT), vendored at public/coi-serviceworker.js,
 * which sets the COOP/COEP headers client-side via a service worker.
 *
 * Task 16 extends the same post-export step to make the web build an
 * installable PWA: it links public/manifest.json (copied into the export dir
 * automatically by `expo export`, along with public/icons/*) and sets the
 * theme-color meta tag, via the pure/tested injectPwaTags() in ./injectCoi.js.
 *
 * Task 17 adds the GitHub Pages SPA fallback: `expo export -p web` (SPA mode)
 * never produces a 404.html, so deep links / refreshes on sub-paths 404 on
 * Pages. The fix is the well-known trick of serving a copy of the final
 * index.html as 404.html, so Pages falls back to the SPA shell and its
 * client-side router takes over.
 *
 * This script, run after `expo export -p web`:
 *   1. Copies public/coi-serviceworker.js into the export dir.
 *   2. Inserts <script src="coi-serviceworker.js"></script> as the first
 *      element in <head>, then the PWA manifest <link> + theme-color <meta>
 *      tags right after it, into dist/index.html (and dist/404.html, if
 *      present), via injectCoiScript() / injectPwaTags() in ./injectCoi.js.
 *   3. Writes dist/404.html as a byte-identical copy of the now-injected
 *      dist/index.html (SPA 404 fallback for GitHub Pages).
 *
 * Usage: node scripts/inject-coi.mjs [exportDir=dist]
 */
import { access, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectCoiScript, injectPwaTags } from './injectCoi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function injectIntoHtmlFile(filePath) {
  if (!(await fileExists(filePath))) {
    return false;
  }
  const html = await readFile(filePath, 'utf8');
  const updated = injectCoiScript(injectPwaTags(html));
  if (updated !== html) {
    await writeFile(filePath, updated, 'utf8');
  }
  return true;
}

async function main() {
  const exportDirArg = process.argv[2] ?? 'dist';
  const distDir = path.resolve(projectRoot, exportDirArg);

  if (!(await fileExists(distDir))) {
    throw new Error(
      `Export directory not found: ${distDir}\nRun "expo export -p web" first (or use "npm run build:web").`
    );
  }

  const publicSwPath = path.join(projectRoot, 'public', 'coi-serviceworker.js');
  const distSwPath = path.join(distDir, 'coi-serviceworker.js');
  await copyFile(publicSwPath, distSwPath);

  const candidateHtmlFiles = ['index.html', '404.html'];
  const processed = [];
  for (const name of candidateHtmlFiles) {
    const wasProcessed = await injectIntoHtmlFile(path.join(distDir, name));
    if (wasProcessed) {
      processed.push(name);
    }
  }

  if (!processed.includes('index.html')) {
    throw new Error(
      `${path.join(distDir, 'index.html')} not found — the export may have failed or used a different output dir.`
    );
  }

  // Task 17: SPA 404 fallback for GitHub Pages. `expo export -p web` (SPA
  // mode) never emits a 404.html, so write one now as a byte-identical copy
  // of the final, post-injection index.html. This must run after the
  // injection loop above so 404.html always matches what actually shipped in
  // index.html (COI script + PWA tags included), and it always overwrites
  // any stale 404.html so re-runs stay deterministic.
  const indexHtmlPath = path.join(distDir, 'index.html');
  const notFoundHtmlPath = path.join(distDir, '404.html');
  await copyFile(indexHtmlPath, notFoundHtmlPath);

  console.log(`[inject-coi] Copied coi-serviceworker.js -> ${path.relative(projectRoot, distSwPath)}`);
  console.log(`[inject-coi] Injected COI <script> + PWA manifest/theme-color tags into: ${processed.join(', ')}`);
  console.log(
    `[inject-coi] Wrote SPA 404 fallback: ${path.relative(projectRoot, notFoundHtmlPath)} (copy of index.html)`
  );
}

main().catch((err) => {
  console.error('[inject-coi] Failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
