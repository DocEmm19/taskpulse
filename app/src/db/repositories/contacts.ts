import { getDb } from '../database';
import { newId } from '../../lib/uuid';
import { notifyTablesChanged } from '../events';
import { nowIso, enqueueSync, logActivity, touchParentTask } from '../helpers';
import { getCurrentUserId } from '../../store/sessionStore';
import { Contact } from '../../types/models';

export interface ContactInput {
  name: string;
  mobile?: string | null;
  alternateMobile?: string | null;
  email?: string | null;
  company?: string | null;
  designation?: string | null;
  remarks?: string | null;
}

export async function listContacts(search?: string): Promise<Contact[]> {
  const db = await getDb();
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return db.getAllAsync<Contact>(
      `SELECT * FROM contacts WHERE deleted_at IS NULL AND (name LIKE ? OR mobile LIKE ? OR company LIKE ? OR email LIKE ?) ORDER BY name ASC`,
      [q, q, q, q]
    );
  }
  return db.getAllAsync<Contact>('SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY name ASC');
}

export async function getContact(id: string): Promise<Contact | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Contact>('SELECT * FROM contacts WHERE id = ?', [id])) ?? null;
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO contacts (id, name, mobile, alternate_mobile, email, company, designation, remarks, created_by, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      input.name.trim(),
      input.mobile || null,
      input.alternateMobile || null,
      input.email || null,
      input.company || null,
      input.designation || null,
      input.remarks || null,
      getCurrentUserId(),
      now,
      now,
    ]
  );
  await enqueueSync('contact', id, 'CREATE', input);
  notifyTablesChanged('contacts');
  return (await getContact(id))!;
}

export async function updateContact(id: string, input: ContactInput): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.runAsync(
    `UPDATE contacts SET name = ?, mobile = ?, alternate_mobile = ?, email = ?, company = ?, designation = ?, remarks = ?, updated_at = ? WHERE id = ?`,
    [
      input.name.trim(),
      input.mobile || null,
      input.alternateMobile || null,
      input.email || null,
      input.company || null,
      input.designation || null,
      input.remarks || null,
      now,
      id,
    ]
  );
  await enqueueSync('contact', id, 'UPDATE', input);
  notifyTablesChanged('contacts');
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.runAsync('UPDATE contacts SET deleted_at = ? WHERE id = ?', [now, id]);
  await enqueueSync('contact', id, 'DELETE');
  notifyTablesChanged('contacts');
}

/** Attach an existing (or newly created) contact to a task. */
export async function linkContactToTask(taskId: string, contactId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync('SELECT id FROM task_contacts WHERE task_id = ? AND contact_id = ?', [taskId, contactId]);
  if (existing) return;
  await db.runAsync('INSERT INTO task_contacts (id, task_id, contact_id, created_at) VALUES (?, ?, ?, ?)', [
    newId(),
    taskId,
    contactId,
    nowIso(),
  ]);
  await logActivity(taskId, 'assigned', 'Contact attached');
  await enqueueSync('task_contact', taskId, 'CREATE', { taskId, contactId });
  await touchParentTask(db, taskId);
  notifyTablesChanged(['task_contacts']);
}

export async function unlinkContactFromTask(taskId: string, contactId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM task_contacts WHERE task_id = ? AND contact_id = ?', [taskId, contactId]);
  notifyTablesChanged(['task_contacts']);
}

export async function getContactsForTask(taskId: string): Promise<Contact[]> {
  const db = await getDb();
  return db.getAllAsync<Contact>(
    `SELECT co.* FROM contacts co JOIN task_contacts tc ON tc.contact_id = co.id WHERE tc.task_id = ? AND co.deleted_at IS NULL ORDER BY co.name ASC`,
    [taskId]
  );
}
