/** @jest-environment jsdom */
// Regression test for the false-cancel race: a fixed short timer must NOT
// declare "cancelled" and drop a recording that `change` delivers a bit later.
// Forces isWeb=true so webVideoCaptureSupported is true under jsdom.
jest.mock('../platform', () => ({ isWeb: true }));

import { captureVideoWeb, CANCEL_GRACE_MS } from '../webVideoCapture';

// A controllable fake <input> so we decide exactly when onchange fires and what
// files it carries — the real DOM input's FileList is not writable in jsdom.
function installFakeInput() {
  const input: any = { style: {}, setAttribute: jest.fn(), click: jest.fn(), remove: jest.fn(), files: null, onchange: null };
  jest.spyOn(document, 'createElement').mockReturnValue(input as any);
  jest.spyOn(document.body, 'appendChild').mockImplementation(((n: any) => n) as any);
  return input;
}

let createObjectURL: jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  createObjectURL = jest.fn(() => 'blob:mock-url');
  // Define (don't read) URL — reading global.URL triggers Expo's lazy winter
  // getter, which pulls in whatwg-url/TextEncoder and throws in this env.
  Object.defineProperty(globalThis, 'URL', { configurable: true, value: { createObjectURL } });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('a recording delivered AFTER the old 1s window is still captured, not dropped', async () => {
  const input = installFakeInput();
  const promise = captureVideoWeb();

  // Camera closes → window refocuses → cancel timer is armed.
  window.dispatchEvent(new Event('focus'));
  // Old bug: at 1s the promise resolved null. Advance past that point.
  jest.advanceTimersByTime(1000);

  // Only now does the browser finish copying the large video into the input.
  input.files = [{ type: 'video/mp4', name: 'clip.mp4', size: 9_000_000 }];
  input.onchange();

  await expect(promise).resolves.toEqual(
    expect.objectContaining({ uri: 'blob:mock-url', mimeType: 'video/mp4', fileName: 'clip.mp4', fileSizeBytes: 9_000_000 })
  );
});

test('a genuine cancel (no file within the grace window) resolves null', async () => {
  const input = installFakeInput();
  const promise = captureVideoWeb();

  window.dispatchEvent(new Event('focus'));
  input.files = []; // user backed out; nothing selected
  jest.advanceTimersByTime(CANCEL_GRACE_MS);

  await expect(promise).resolves.toBeNull();
});

test('does not mint an object URL when a late change loses to an already-settled cancel', async () => {
  const input = installFakeInput();
  const promise = captureVideoWeb();

  window.dispatchEvent(new Event('focus'));
  input.files = [];
  jest.advanceTimersByTime(CANCEL_GRACE_MS); // resolves null, settled = true
  await promise;

  // An extremely late change must be a no-op — no leaked blob URL.
  input.files = [{ type: 'video/mp4', name: 'late.mp4', size: 1 }];
  input.onchange();
  expect(createObjectURL).not.toHaveBeenCalled();
});
