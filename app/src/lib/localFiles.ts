import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

const ATTACHMENTS_DIR_NAME = 'attachments';

function attachmentsDir(): Directory {
  const dir = new Directory(Paths.document, ATTACHMENTS_DIR_NAME);
  try {
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {
    // already exists / created by a concurrent call — fine either way
  }
  return dir;
}

/** expo-file-system's File/Directory/Paths API (used below for native) has no
 * web implementation at all — Paths.document is '' on web and File/Directory
 * are non-functional stubs there, so the native copy path throws immediately
 * on click for every attachment type. Pickers/recorders on web hand back a
 * blob: (or already a data:) URI; converting that to a data: URL gives a
 * plain string that both survives being stored in the `attachments.local_path`
 * column and re-loads correctly next time (a blob: URL does not survive a
 * page reload, since it's tied to the in-memory Blob). This is real,
 * persisted file data — not a fake/placeholder success. */
async function persistLocalFileWeb(sourceUri: string): Promise<string> {
  if (sourceUri.startsWith('data:')) return sourceUri;
  const response = await fetch(sourceUri);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment data'));
    reader.readAsDataURL(blob);
  });
  // `sourceUri` here is a blob: object URL (e.g. from the web audio
  // recorder or a file picker) — once its bytes are safely read into the
  // plain data: string above, the original object URL reference is no
  // longer needed. Revoking it releases the browser's in-memory Blob
  // registry entry instead of leaking it for the rest of the tab's
  // lifetime, which matters most for audio recordings made (and possibly
  // re-recorded/discarded) on the New Task screen before the task is saved.
  if (sourceUri.startsWith('blob:')) {
    URL.revokeObjectURL(sourceUri);
  }
  return dataUrl;
}

/** Copies a picker/recorder result (which usually lives in a temp cache dir)
 * into the app's permanent documents directory, so it survives the way
 * local-first data is supposed to (see ARCHITECTURE.md §4.4) — attachments
 * must be usable immediately and stay usable even if the OS clears caches
 * before the Sync Engine has uploaded them. Returns the new file's URI, which
 * is what gets stored in `attachments.local_path`. */
export async function persistLocalFile(sourceUri: string, extension: string): Promise<string> {
  if (Platform.OS === 'web') {
    return persistLocalFileWeb(sourceUri);
  }
  const dir = attachmentsDir();
  const fileName = `${Date.now()}_${Math.round(Math.random() * 1e6)}.${extension}`;
  const sourceFile = new File(sourceUri);
  const destFile = new File(dir, fileName);
  await sourceFile.copy(destFile);
  return destFile.uri;
}

/** Reads a locally-stored attachment as raw bytes for upload to Supabase
 * Storage — no base64 round-trip needed with the modern expo-file-system API. */
export async function readFileBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    // On web, local_path is a data: (or blob:) URL, not a filesystem path —
    // expo-file-system's File can't read it. fetch() decodes both (same trick
    // persistLocalFileWeb uses). Without this, the Storage upload silently
    // failed on web, so web attachments never left the device. P1.
    const res = await fetch(uri);
    return new Uint8Array(await res.arrayBuffer());
  }
  const file = new File(uri);
  return file.bytes();
}

/** Persists a file downloaded from Supabase Storage (a Blob) into this device's
 * local store and returns the local_path to save on the attachment row. Web
 * stores it as a data: URL (same shape as picker/recorder results, so playback
 * and preview work unchanged); native writes it to the app's documents dir.
 * This is the receive side of Storage-based attachment sync — the counterpart
 * to readFileBytes()/pushAttachmentFile()'s upload. */
export async function persistDownloadedFile(blob: Blob, extension: string): Promise<string> {
  if (Platform.OS === 'web') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read downloaded attachment'));
      reader.readAsDataURL(blob);
    });
  }
  const dir = attachmentsDir();
  const fileName = `${Date.now()}_${Math.round(Math.random() * 1e6)}.${extension}`;
  const destFile = new File(dir, fileName);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  destFile.create();
  destFile.write(bytes);
  return destFile.uri;
}
