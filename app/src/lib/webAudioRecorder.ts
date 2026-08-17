import { isWeb } from './platform';

/**
 * True only when running on web AND the browser actually exposes the APIs
 * this module needs (`navigator.mediaDevices.getUserMedia` + `MediaRecorder`).
 * AttachmentsSection uses this to decide whether to show the "Record Audio"
 * button on web instead of hiding it outright.
 */
export const webRecordingSupported: boolean =
  isWeb &&
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function' &&
  typeof MediaRecorder !== 'undefined';

export interface WebRecordingResult {
  /** Object-URL (or data URI) pointing at the recorded audio Blob. */
  uri: string;
  /** e.g. "audio/webm" or "audio/webm;codecs=opus" — always audio/*. */
  mimeType: string;
  fileName: string;
}

export interface WebRecordingHandle {
  stop: () => Promise<WebRecordingResult>;
}

const MIME_CANDIDATES = ['audio/webm', 'audio/mp4', 'audio/ogg'];

function pickMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported?.(candidate)) return candidate;
  }
  return '';
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/**
 * Requests mic access and starts recording via the browser's MediaRecorder.
 * Returns a handle whose `stop()` finalizes the recording and resolves an
 * object-URL for the audio Blob — the same shape the native record path
 * hands to `persistLocalFile`/`addAttachment`, so callers can reuse that
 * exact save path for web recordings too.
 */
export async function startWebRecording(): Promise<WebRecordingHandle> {
  if (!webRecordingSupported) {
    throw new Error('Voice recording is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferredMimeType = pickMimeType();
  const recorder = preferredMimeType
    ? new MediaRecorder(stream, { mimeType: preferredMimeType })
    : new MediaRecorder(stream);

  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event: BlobEvent) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  });

  recorder.start();

  return {
    stop: () =>
      new Promise<WebRecordingResult>((resolve, reject) => {
        recorder.addEventListener('error', () => reject(new Error('Recording failed')));
        recorder.addEventListener('stop', () => {
          stream.getTracks().forEach((track) => track.stop());
          const mimeType = recorder.mimeType || preferredMimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: mimeType });
          const uri = URL.createObjectURL(blob);
          resolve({
            uri,
            mimeType: blob.type || mimeType,
            fileName: `voice_note_${Date.now()}.${extensionFor(mimeType)}`,
          });
        });
        recorder.stop();
      }),
  };
}
