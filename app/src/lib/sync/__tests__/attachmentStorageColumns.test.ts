// Attachment files must sync via Supabase Storage, NOT as base64 inside the
// Postgres row. `local_path` holds the file bytes as a data: URL on web, so
// shipping it through the (500MB free-tier) database bloated it and would break
// on large videos. This pins the contract: the synced attachment columns carry
// the Storage pointer (storage_path) but never local_path.
import { TABLE_COLUMNS } from '../syncTables';

describe('attachments cloud sync columns', () => {
  test('exclude local_path (no base64 bytes in Postgres)', () => {
    expect(TABLE_COLUMNS.attachments).not.toContain('local_path');
  });

  test('include storage_path (the Supabase Storage pointer files travel through)', () => {
    expect(TABLE_COLUMNS.attachments).toContain('storage_path');
  });
});
