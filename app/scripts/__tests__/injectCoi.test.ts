import {
  injectCoiScript,
  injectPwaTags,
  COI_SCRIPT_TAG,
  MANIFEST_LINK_TAG,
  THEME_COLOR_META_TAG,
} from '../injectCoi';

describe('injectCoiScript', () => {
  it('injects the script tag as the first element in <head>', () => {
    const html = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';

    const result = injectCoiScript(html);

    expect(result).toBe(
      `<html><head>${COI_SCRIPT_TAG}<title>x</title></head><body><div id="root"></div></body></html>`
    );
  });

  it('is idempotent: running it twice does not double-insert the tag', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';

    const once = injectCoiScript(html);
    const twice = injectCoiScript(once);

    expect(twice).toBe(once);
    expect(twice.match(/coi-serviceworker\.js/g)).toHaveLength(1);
  });

  it('leaves the body untouched', () => {
    const html =
      '<html><head></head><body><div id="root">do not touch me</div><script src="app.js"></script></body></html>';

    const result = injectCoiScript(html);

    expect(result).toContain(
      '<body><div id="root">do not touch me</div><script src="app.js"></script></body>'
    );
  });

  it('handles a <head> tag with attributes', () => {
    const html = '<html><head lang="en" data-foo="bar"><title>x</title></head><body></body></html>';

    const result = injectCoiScript(html);

    expect(result).toBe(
      `<html><head lang="en" data-foo="bar">${COI_SCRIPT_TAG}<title>x</title></head><body></body></html>`
    );
  });

  it('returns the input unchanged when there is no <head> tag', () => {
    const html = '<html><body>no head here</body></html>';

    expect(injectCoiScript(html)).toBe(html);
  });
});

describe('injectPwaTags', () => {
  it('injects the manifest link and theme-color meta tags into <head>', () => {
    const html = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';

    const result = injectPwaTags(html);

    expect(result).toContain(MANIFEST_LINK_TAG);
    expect(result).toContain(THEME_COLOR_META_TAG);
    expect(result).toBe(
      `<html><head>${MANIFEST_LINK_TAG}${THEME_COLOR_META_TAG}<title>x</title></head><body><div id="root"></div></body></html>`
    );
  });

  it('is idempotent: running it twice does not double-insert either tag', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';

    const once = injectPwaTags(html);
    const twice = injectPwaTags(once);

    expect(twice).toBe(once);
    expect(twice.match(/rel="manifest"/g)).toHaveLength(1);
    expect(twice.match(/name="theme-color"/g)).toHaveLength(1);
  });

  it('leaves the body untouched', () => {
    const html =
      '<html><head></head><body><div id="root">do not touch me</div><script src="app.js"></script></body></html>';

    const result = injectPwaTags(html);

    expect(result).toContain(
      '<body><div id="root">do not touch me</div><script src="app.js"></script></body>'
    );
  });

  it('returns the input unchanged when there is no <head> tag', () => {
    const html = '<html><body>no head here</body></html>';

    expect(injectPwaTags(html)).toBe(html);
  });

  it('composes with injectCoiScript so the COI script stays the first head element', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';

    const result = injectCoiScript(injectPwaTags(html));

    expect(result).toBe(
      `<html><head>${COI_SCRIPT_TAG}${MANIFEST_LINK_TAG}${THEME_COLOR_META_TAG}<title>x</title></head><body></body></html>`
    );
  });
});
