import { Attachment, AttachmentType } from '../types/models';

/** A file picked/recorded before a task exists yet (New Task screen) — not
 * written to the DB until the task itself is created, at which point the
 * caller (NewEditTaskScreen) turns each of these into a real `addAttachment`
 * call with the freshly-created taskId.
 *
 * Deliberately kept in its own file, separate from AttachmentsSection.tsx:
 * that component pulls in expo-audio/expo-video/expo-image-picker (native
 * modules that fail to load under plain Jest), so this pure, dependency-free
 * type + helper stays independently importable/unit-testable. */
export interface PendingAttachment {
  localId: string;
  fileType: AttachmentType;
  fileName: string;
  localPath: string;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
}

/** Shapes a not-yet-saved PendingAttachment into the same `Attachment` shape
 * the DB-backed list uses, so both render through one shared list/renderer. */
export function pendingToAttachment(p: PendingAttachment, taskId: string | null): Attachment {
  return {
    id: p.localId,
    task_id: taskId ?? '',
    file_type: p.fileType,
    file_name: p.fileName,
    file_size_bytes: p.fileSizeBytes ?? null,
    mime_type: p.mimeType ?? null,
    duration_seconds: p.durationSeconds ?? null,
    local_path: p.localPath,
    storage_path: null,
    uploaded_by: null,
    sync_status: 'pending_upload',
    created_at: '',
    updated_at: null,
  };
}
