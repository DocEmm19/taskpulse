import { isWeb } from './platform';

/**
 * Web camera video capture. Unlike the web AUDIO recorder (which uses
 * getUserMedia + MediaRecorder + an in-app preview), video capture uses a
 * native `<input type="file" accept="video/*" capture>`. On a phone browser
 * that opens the OS camera in VIDEO mode — live video + audio recording,
 * handled by the platform — and hands back the recorded file. On desktop it
 * degrades to a file chooser (no camera), which is acceptable: desktop users
 * still have the "Video File" picker.
 *
 * Chosen over getUserMedia/MediaRecorder deliberately: no preview/stop UI to
 * build, no MediaRecorder codec juggling, and — importantly for this app — no
 * COEP/permissions-API friction under the COOP/COEP isolation the SQLite-WASM
 * service worker requires. The OS camera app does the recording.
 */
export const webVideoCaptureSupported: boolean = isWeb && typeof document !== 'undefined';

export interface WebVideoCaptureResult {
  /** blob: object URL for the captured file — same shape persistLocalFile expects. */
  uri: string;
  mimeType: string; // e.g. "video/mp4", "video/webm", "video/quicktime"
  fileName: string;
  fileSizeBytes: number | null;
}

// Grace period before a window-refocus is treated as a cancel. Long on purpose:
// for video, the browser can take several seconds after the camera closes to
// copy a large recording into the input's FileList, so a short timer would
// declare "cancelled" and silently drop a real recording. `change` is the
// authoritative signal; this is only the true-cancel fallback. Exported so the
// test can drive it deterministically.
export const CANCEL_GRACE_MS = 15000;

/** Maps a captured video's MIME type to a file extension for persistLocalFile. */
export function videoExtensionFor(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('quicktime') || m.includes('mov')) return 'mov';
  if (m.includes('3gpp')) return '3gp';
  if (m.includes('ogg')) return 'ogv';
  return 'webm';
}

/**
 * Opens the camera (mobile) / file chooser (desktop) and resolves with the
 * captured video, or `null` if the user cancels. Never rejects for a normal
 * cancel — only throws if the DOM APIs are missing entirely.
 */
export function captureVideoWeb(): Promise<WebVideoCaptureResult | null> {
  if (!webVideoCaptureSupported) {
    throw new Error('Video capture is only available in a browser.');
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    // `capture` asks mobile browsers to open the camera directly rather than a
    // file list. "environment" = rear camera (better for documenting things);
    // the browser falls back to a chooser if it can't honor it.
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';

    let settled = false;
    const resolveWith = (result: WebVideoCaptureResult | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(result);
    };

    const resolveFile = (file: File) => {
      // Guard BEFORE createObjectURL so a losing/late branch never mints a
      // blob: URL that then leaks unrevoked for the life of the page.
      if (settled) return;
      const mimeType = file.type || 'video/mp4';
      resolveWith({
        uri: URL.createObjectURL(file),
        mimeType,
        fileName: file.name || `video_${Date.now()}.${videoExtensionFor(mimeType)}`,
        fileSizeBytes: typeof file.size === 'number' ? file.size : null,
      });
    };

    // `change` is authoritative: a real selection always fires it (with the
    // file); an empty FileList means the user cancelled from the chooser.
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) resolveFile(file);
      else resolveWith(null);
    };

    // True-cancel fallback. Backing out of the camera refocuses the window
    // WITHOUT firing `change` — but so does a successful capture, and for video
    // `change` can land seconds later while the browser copies a large file
    // into the FileList. So never guess-cancel on a short timer (that silently
    // drops real recordings). Wait CANCEL_GRACE_MS, and even then cancel only
    // if no file has arrived — otherwise `change` owns the result.
    window.addEventListener(
      'focus',
      () =>
        setTimeout(() => {
          if (settled) return;
          if (input.files && input.files.length > 0) return; // a selection landed; onchange will resolve it
          resolveWith(null);
        }, CANCEL_GRACE_MS),
      { once: true }
    );

    document.body.appendChild(input);
    input.click();
  });
}
