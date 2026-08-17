'use strict';

/**
 * Shared logic for Task 15 (COOP/COEP service worker on GitHub Pages) and
 * Task 16 (PWA manifest + theme-color tags).
 *
 * Plain CommonJS on purpose: it needs to be `require()`-able by Jest (via the
 * jest-expo preset, no extra transform config) AND importable from the ESM
 * post-export script `scripts/inject-coi.mjs` (Node's CJS/ESM interop resolves
 * named imports from `module.exports = { ... }` via static analysis).
 */

const COI_SCRIPT_TAG = '<script src="coi-serviceworker.js"></script>';
const MANIFEST_LINK_TAG = '<link rel="manifest" href="manifest.json">';
const THEME_COLOR_META_TAG = '<meta name="theme-color" content="#2452E8">';

const HEAD_OPEN_TAG_RE = /<head(\s[^>]*)?>/i;

/**
 * Pure function: inserts the COI service-worker <script> tag as the first
 * element inside <head>. Idempotent — returns the input unchanged if the tag
 * is already present. Does not touch anything outside of <head>...</head>.
 *
 * @param {string} html
 * @returns {string}
 */
function injectCoiScript(html) {
  if (typeof html !== 'string') {
    throw new TypeError('injectCoiScript expects an HTML string');
  }
  if (html.includes(COI_SCRIPT_TAG)) {
    return html;
  }
  if (!HEAD_OPEN_TAG_RE.test(html)) {
    return html;
  }
  return html.replace(HEAD_OPEN_TAG_RE, (openTag) => `${openTag}${COI_SCRIPT_TAG}`);
}

/**
 * Pure function: inserts the PWA `<link rel="manifest">` and
 * `<meta name="theme-color">` tags into `<head>` (right after the opening
 * tag, same convention as injectCoiScript). Idempotent — each tag is added
 * at most once, independently, so re-running never double-inserts. Does not
 * touch anything outside of <head>...</head>.
 *
 * @param {string} html
 * @returns {string}
 */
function injectPwaTags(html) {
  if (typeof html !== 'string') {
    throw new TypeError('injectPwaTags expects an HTML string');
  }
  if (!HEAD_OPEN_TAG_RE.test(html)) {
    return html;
  }
  const missingTags = [MANIFEST_LINK_TAG, THEME_COLOR_META_TAG].filter(
    (tag) => !html.includes(tag)
  );
  if (missingTags.length === 0) {
    return html;
  }
  return html.replace(HEAD_OPEN_TAG_RE, (openTag) => `${openTag}${missingTags.join('')}`);
}

module.exports = {
  injectCoiScript,
  injectPwaTags,
  COI_SCRIPT_TAG,
  MANIFEST_LINK_TAG,
  THEME_COLOR_META_TAG,
};
