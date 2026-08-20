// The New Task screen has no task id yet (attachments require one — see
// schema_and_setup.sql, attachments.task_id is NOT NULL) so files picked
// there are held as PendingAttachment objects and rendered through the same
// list as real, DB-backed Attachment rows via `pendingToAttachment`. This
// test proves that conversion produces a well-formed, displayable Attachment
// shape without needing to render the component (no React Native Testing
// Library in this project — see jest.config.js).
//
// Imported from lib/pendingAttachments (not AttachmentsSection.tsx directly):
// that component pulls in expo-audio/expo-video/expo-image-picker, which
// throw under plain Jest outside a real native/Expo runtime.
import { pendingToAttachment, PendingAttachment } from '../../lib/pendingAttachments';

describe('pendingToAttachment (AttachmentsSection pending mode)', () => {
  const basePending: PendingAttachment = {
    localId: 'local-1',
    fileType: 'image',
    fileName: 'photo_123.jpg',
    localPath: 'data:image/jpeg;base64,abc123',
    fileSizeBytes: 4096,
    mimeType: 'image/jpeg',
    durationSeconds: null,
  };

  test('carries the file fields through unchanged', () => {
    const att = pendingToAttachment(basePending, null);
    expect(att.file_type).toBe('image');
    expect(att.file_name).toBe('photo_123.jpg');
    expect(att.local_path).toBe('data:image/jpeg;base64,abc123');
    expect(att.file_size_bytes).toBe(4096);
    expect(att.mime_type).toBe('image/jpeg');
  });

  test('id is the pending item\'s localId, so delete/rename can look it back up', () => {
    const att = pendingToAttachment(basePending, null);
    expect(att.id).toBe('local-1');
  });

  test('is always marked pending_upload — it is not yet in the DB', () => {
    const att = pendingToAttachment(basePending, null);
    expect(att.sync_status).toBe('pending_upload');
  });

  test('task_id falls back to empty string when no task exists yet', () => {
    const att = pendingToAttachment(basePending, null);
    expect(att.task_id).toBe('');
  });

  test('optional fields default to null rather than undefined (matches the Attachment DB row shape)', () => {
    const minimal: PendingAttachment = {
      localId: 'local-2',
      fileType: 'pdf',
      fileName: 'doc.pdf',
      localPath: 'file:///tmp/doc.pdf',
    };
    const att = pendingToAttachment(minimal, null);
    expect(att.file_size_bytes).toBeNull();
    expect(att.mime_type).toBeNull();
    expect(att.duration_seconds).toBeNull();
    expect(att.storage_path).toBeNull();
    expect(att.uploaded_by).toBeNull();
  });
});
