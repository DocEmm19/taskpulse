import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Task reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return req.granted;
}

/** Schedules a local (fully offline-capable) reminder — Req. #34. Returns the
 * OS notification id so it can be cancelled later if the task/date changes. */
export async function scheduleLocalReminder(title: string, body: string, fireAt: Date): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  if (fireAt.getTime() <= Date.now()) return null;
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
  return id;
}

export async function cancelReminder(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

// Reminder message builders for the reminder types called out in ARCHITECTURE.md §7.
export function reminderMessages(kind: 'due_today' | 'overdue' | 'meeting' | 'travel' | 'followup' | 'p1', taskTitle: string) {
  switch (kind) {
    case 'due_today':
      return { title: 'Due today', body: taskTitle };
    case 'overdue':
      return { title: 'Overdue', body: taskTitle };
    case 'meeting':
      return { title: 'Meeting starting soon', body: taskTitle };
    case 'travel':
      return { title: 'Travel tomorrow', body: taskTitle };
    case 'followup':
      return { title: 'Follow-up reminder', body: taskTitle };
    case 'p1':
      return { title: 'P1 — Critical task', body: taskTitle };
  }
}
