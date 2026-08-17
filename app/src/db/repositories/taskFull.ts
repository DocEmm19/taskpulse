import { getDb } from '../database';
import { getTaskById } from './tasks';
import { getContactsForTask } from './contacts';
import { getEmailsForTask, getLinksForTask, getLocationForTask, getMeetingForTask, getCalendarEventForTask, getTravelPlanForTask, getRemindersForTask } from './taskExtras';
import { getAttachmentsForTask } from './attachments';
import { TaskActivity, TaskFull, TaskReassignment, TaskRemark } from '../../types/models';

export async function getRemarksForTask(taskId: string): Promise<TaskRemark[]> {
  const db = await getDb();
  return db.getAllAsync<TaskRemark>('SELECT * FROM task_remarks WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
}

export async function getActivityForTask(taskId: string): Promise<TaskActivity[]> {
  const db = await getDb();
  return db.getAllAsync<TaskActivity>('SELECT * FROM task_activity WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
}

export async function getReassignmentsForTask(taskId: string): Promise<TaskReassignment[]> {
  const db = await getDb();
  return db.getAllAsync<TaskReassignment>('SELECT * FROM task_reassignments WHERE task_id = ? ORDER BY changed_at DESC', [taskId]);
}

/** One call that hydrates everything the Task Detail screen needs (Req. #27). */
export async function getTaskFull(taskId: string): Promise<TaskFull | null> {
  const task = await getTaskById(taskId);
  if (!task) return null;

  const [remarks, activity, reassignments, contacts, emails, links, location, meeting, calendarEvent, travel, attachments, reminders] =
    await Promise.all([
      getRemarksForTask(taskId),
      getActivityForTask(taskId),
      getReassignmentsForTask(taskId),
      getContactsForTask(taskId),
      getEmailsForTask(taskId),
      getLinksForTask(taskId),
      getLocationForTask(taskId),
      getMeetingForTask(taskId),
      getCalendarEventForTask(taskId),
      getTravelPlanForTask(taskId),
      getAttachmentsForTask(taskId),
      getRemindersForTask(taskId),
    ]);

  return { task, remarks, activity, reassignments, contacts, emails, links, location, meeting, calendarEvent, travel, attachments, reminders };
}
