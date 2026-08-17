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
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment data'));
    reader.readAsDataURL(blob);
  });
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
  const file = new File(uri);
  return file.bytes();
}
