import { getDb } from '../database';
import { newId } from '../../lib/uuid';
import { notifyTablesChanged } from '../events';
import { nowIso, enqueueSync, logActivity } from '../helpers';
import { getCurrentUserId } from '../../store/sessionStore';
import { Attachment, AttachmentType } from '../../types/models';

export interface AddAttachmentInput {
  taskId: string;
  fileType: AttachmentType;
  fileName: string;
  localPath: string;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
}

export async function addAttachment(input: AddAttachmentInput): Promise<Attachment> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO attachments (id, task_id, file_type, file_name, file_size_bytes, mime_type, duration_seconds, local_path, storage_path, uploaded_by, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'pending_upload', ?, ?)`,
    [id, input.taskId, input.fileType, input.fileName, input.fileSizeBytes ?? null, input.mimeType ?? null, input.durationSeconds ?? null, input.localPath, getCurrentUserId(), now, now]
  );
  await logActivity(input.taskId, 'attachment_added', `${labelFor(input.fileType)} added: ${input.fileName}`);
  await enqueueSync('attachment', id, 'UPLOAD_FILE', { localPath: input.localPath, fileType: input.fileType });
  notifyTablesChanged(['attachments', 'task_activity']);
  return (await db.getFirstAsync<Attachment>('SELECT * FROM attachments WHERE id = ?', [id]))!;
}

function labelFor(t: AttachmentType) {
  return { image: 'Image', pdf: 'PDF', audio: 'Audio recording', video: 'Video' }[t];
}

export async function getAttachmentsForTask(taskId: string): Promise<Attachment[]> {
  const db = await getDb();
  return db.getAllAsync<Attachment>('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
}

export async function renameAttachment(id: string, newName: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE attachments SET file_name = ?, updated_at = ? WHERE id = ?', [newName, nowIso(), id]);
  await enqueueSync('attachment', id, 'UPDATE', { fileName: newName });
  notifyTablesChanged('attachments');
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM attachments WHERE id = ?', [id]);
  await enqueueSync('attachment', id, 'DELETE_FILE');
  notifyTablesChanged('attachments');
}
