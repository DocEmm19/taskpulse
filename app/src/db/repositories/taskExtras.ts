// Repositories for the "many facets of one task" tables: emails, links (web +
// meeting), location (maps), meeting, calendar event, travel plan, reminders.
// Kept in one file since each is a small, single-purpose CRUD set.

import { getDb } from '../database';
import { newId } from '../../lib/uuid';
import { notifyTablesChanged } from '../events';
import { nowIso, enqueueSync, logActivity, touchParentTask } from '../helpers';
import {
  CalendarEventRow,
  LinkType,
  Meeting,
  Reminder,
  TaskEmail,
  TaskLink,
  TaskLocation,
  TravelPlan,
} from '../../types/models';

// ---------- Emails ----------
export async function addTaskEmail(taskId: string, emailAddress: string, subject?: string | null, body?: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO task_emails (id, task_id, email_address, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [newId(), taskId, emailAddress.trim(), subject || null, body || null, nowIso()]
  );
  await enqueueSync('task_email', taskId, 'CREATE', { emailAddress, subject, body });
  await touchParentTask(db, taskId);
  notifyTablesChanged('task_emails');
}
export async function getEmailsForTask(taskId: string): Promise<TaskEmail[]> {
  const db = await getDb();
  return db.getAllAsync<TaskEmail>('SELECT * FROM task_emails WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
}
export async function deleteTaskEmail(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM task_emails WHERE id = ?', [id]);
  notifyTablesChanged('task_emails');
}

// ---------- Links (website + meeting links) ----------
export async function addTaskLink(taskId: string, linkType: LinkType, url: string, label?: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT INTO task_links (id, task_id, link_type, label, url, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [
    newId(),
    taskId,
    linkType,
    label || null,
    url.trim(),
    nowIso(),
  ]);
  await enqueueSync('task_link', taskId, 'CREATE', { linkType, url, label });
  await touchParentTask(db, taskId);
  notifyTablesChanged('task_links');
}
export async function getLinksForTask(taskId: string): Promise<TaskLink[]> {
  const db = await getDb();
  return db.getAllAsync<TaskLink>('SELECT * FROM task_links WHERE task_id = ? ORDER BY created_at ASC', [taskId]);
}
export async function deleteTaskLink(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM task_links WHERE id = ?', [id]);
  notifyTablesChanged('task_links');
}

// ---------- Location (Google Maps) ----------
export async function setTaskLocation(
  taskId: string,
  data: { label?: string | null; address?: string | null; mapsUrl?: string | null; latitude?: number | null; longitude?: number | null }
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<TaskLocation>('SELECT * FROM locations WHERE task_id = ?', [taskId]);
  if (existing) {
    await db.runAsync('UPDATE locations SET label = ?, address = ?, maps_url = ?, latitude = ?, longitude = ? WHERE id = ?', [
      data.label ?? existing.label,
      data.address ?? existing.address,
      data.mapsUrl ?? existing.maps_url,
      data.latitude ?? existing.latitude,
      data.longitude ?? existing.longitude,
      existing.id,
    ]);
  } else {
    await db.runAsync(
      `INSERT INTO locations (id, task_id, label, address, maps_url, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), taskId, data.label || null, data.address || null, data.mapsUrl || null, data.latitude ?? null, data.longitude ?? null, nowIso()]
    );
  }
  await enqueueSync('location', taskId, 'CREATE', data);
  await touchParentTask(db, taskId);
  notifyTablesChanged('locations');
}
export async function getLocationForTask(taskId: string): Promise<TaskLocation | null> {
  const db = await getDb();
  return (await db.getFirstAsync<TaskLocation>('SELECT * FROM locations WHERE task_id = ?', [taskId])) ?? null;
}

// ---------- Meeting (lightweight, tied to a task) ----------
export async function setTaskMeeting(
  taskId: string,
  data: { title: string; startTime: string; endTime?: string | null; location?: string | null; meetingLink?: string | null; participants?: string | null; remarks?: string | null }
): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  const existing = await db.getFirstAsync<Meeting>('SELECT * FROM meetings WHERE task_id = ?', [taskId]);
  if (existing) {
    await db.runAsync(
      `UPDATE meetings SET title = ?, start_time = ?, end_time = ?, location = ?, meeting_link = ?, participants = ?, remarks = ?, updated_at = ? WHERE id = ?`,
      [data.title, data.startTime, data.endTime || null, data.location || null, data.meetingLink || null, data.participants || null, data.remarks || null, now, existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO meetings (id, task_id, title, start_time, end_time, location, meeting_link, participants, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), taskId, data.title, data.startTime, data.endTime || null, data.location || null, data.meetingLink || null, data.participants || null, data.remarks || null, now, now]
    );
  }
  await logActivity(taskId, 'reminder_set', `Meeting scheduled: ${data.title}`);
  await enqueueSync('meeting', taskId, 'CREATE', data);
  await touchParentTask(db, taskId);
  notifyTablesChanged(['meetings', 'task_activity']);
}
export async function getMeetingForTask(taskId: string): Promise<Meeting | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Meeting>('SELECT * FROM meetings WHERE task_id = ?', [taskId])) ?? null;
}
export async function listMeetingsBetween(startIso: string, endIso: string): Promise<Meeting[]> {
  const db = await getDb();
  return db.getAllAsync<Meeting>('SELECT * FROM meetings WHERE start_time >= ? AND start_time < ? ORDER BY start_time ASC', [startIso, endIso]);
}
export async function listUpcomingMeetings(limit = 20): Promise<Meeting[]> {
  const db = await getDb();
  return db.getAllAsync<Meeting>('SELECT * FROM meetings WHERE start_time >= ? ORDER BY start_time ASC LIMIT ?', [nowIso(), limit]);
}

// ---------- Calendar events (mirrors what's added to the device calendar) ----------
export async function addCalendarEvent(data: {
  taskId?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  meetingLink?: string | null;
  participants?: string | null;
  remarks?: string | null;
  provider?: 'device' | 'google' | 'apple';
  externalEventId?: string | null;
}): Promise<CalendarEventRow> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO calendar_events (id, task_id, title, start_time, end_time, location, meeting_link, participants, remarks, provider, external_event_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.taskId || null,
      data.title,
      data.startTime,
      data.endTime,
      data.location || null,
      data.meetingLink || null,
      data.participants || null,
      data.remarks || null,
      data.provider || 'device',
      data.externalEventId || null,
      now,
      now,
    ]
  );
  if (data.taskId) {
    await logActivity(data.taskId, 'reminder_set', `Calendar event created: ${data.title}`);
    await touchParentTask(db, data.taskId);
  }
  await enqueueSync('calendar_event', id, 'CREATE', data);
  notifyTablesChanged(['calendar_events', 'task_activity']);
  return (await db.getFirstAsync<CalendarEventRow>('SELECT * FROM calendar_events WHERE id = ?', [id]))!;
}
export async function getCalendarEventForTask(taskId: string): Promise<CalendarEventRow | null> {
  const db = await getDb();
  return (await db.getFirstAsync<CalendarEventRow>('SELECT * FROM calendar_events WHERE task_id = ?', [taskId])) ?? null;
}
export async function listCalendarEventsBetween(startIso: string, endIso: string): Promise<CalendarEventRow[]> {
  const db = await getDb();
  return db.getAllAsync<CalendarEventRow>(
    'SELECT * FROM calendar_events WHERE start_time >= ? AND start_time < ? ORDER BY start_time ASC',
    [startIso, endIso]
  );
}

// ---------- Travel plans ----------
export interface TravelInput {
  city: string;
  travelDate: string;
  returnDate?: string | null;
  purpose?: string | null;
  hotelName?: string | null;
  hotelAddress?: string | null;
  travelBookingLink?: string | null;
}
export async function setTravelPlan(taskId: string, input: TravelInput): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  const existing = await db.getFirstAsync<TravelPlan>('SELECT * FROM travel_plans WHERE task_id = ?', [taskId]);
  if (existing) {
    await db.runAsync(
      `UPDATE travel_plans SET city=?, travel_date=?, return_date=?, purpose=?, hotel_name=?, hotel_address=?, travel_booking_link=?, updated_at=? WHERE id=?`,
      [input.city, input.travelDate, input.returnDate || null, input.purpose || null, input.hotelName || null, input.hotelAddress || null, input.travelBookingLink || null, now, existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO travel_plans (id, task_id, city, travel_date, return_date, purpose, hotel_name, hotel_address, travel_booking_link, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), taskId, input.city, input.travelDate, input.returnDate || null, input.purpose || null, input.hotelName || null, input.hotelAddress || null, input.travelBookingLink || null, now, now]
    );
  }
  await logActivity(taskId, 'reminder_set', `Travel plan set: ${input.city}`);
  await enqueueSync('travel_plan', taskId, 'CREATE', input);
  await touchParentTask(db, taskId);
  notifyTablesChanged(['travel_plans', 'task_activity']);
}
export async function getTravelPlanForTask(taskId: string): Promise<TravelPlan | null> {
  const db = await getDb();
  return (await db.getFirstAsync<TravelPlan>('SELECT * FROM travel_plans WHERE task_id = ?', [taskId])) ?? null;
}
export async function listTravelPlans(): Promise<Array<TravelPlan & { task_title: string; task_status: string }>> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT tp.*, t.title as task_title, t.status as task_status FROM travel_plans tp
     JOIN tasks t ON t.id = tp.task_id WHERE t.deleted_at IS NULL ORDER BY tp.travel_date ASC`
  );
}

// ---------- Reminders ----------
export async function addReminder(taskId: string, remindAt: string, message?: string | null, notificationId?: string | null): Promise<Reminder> {
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    `INSERT INTO reminders (id, task_id, remind_at, message, is_sent, notification_id, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, taskId, remindAt, message || null, notificationId || null, nowIso()]
  );
  notifyTablesChanged('reminders');
  return (await db.getFirstAsync<Reminder>('SELECT * FROM reminders WHERE id = ?', [id]))!;
}
export async function getRemindersForTask(taskId: string): Promise<Reminder[]> {
  const db = await getDb();
  return db.getAllAsync<Reminder>('SELECT * FROM reminders WHERE task_id = ? ORDER BY remind_at ASC', [taskId]);
}
export async function deleteReminder(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  notifyTablesChanged('reminders');
}
