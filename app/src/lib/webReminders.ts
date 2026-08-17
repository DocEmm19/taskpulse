import { isWeb } from './platform';

// ----------------------------------------------------------------------------
// webReminders.ts — best-effort reminder delivery on web (Task 17A).
//
// Native reminders (src/lib/notifications.ts, expo-notifications) are
// OS-scheduled and survive the app being closed. There is no equivalent
// guarantee on web: the standard `Notification` API can only fire a
// notification while some page/tab from this origin is open (a service
// worker can extend that a little via `showNotification`, but nothing on the
// web platform can wake up and deliver a reminder once every tab is fully
// closed — especially on iPhone Safari, which restricts background
// notifications even further). So this module is explicitly BEST-EFFORT:
// it schedules an in-session `setTimeout` that fires a `Notification` at the
// requested time while the app is open, and — opportunistically, best-effort
// only — also asks any already-registered service worker (e.g. Task 15's
// coi-serviceworker.js) to show it via `ServiceWorkerRegistration
// .showNotification`, since that path is somewhat more likely to survive a
// backgrounded (not closed) tab. Callers MUST surface the closed-tab caveat
// in the UI — see NewEditTaskScreen.tsx's reminder note.
//
// Everything here is guarded so it is safe to import (and a no-op) under
// Jest / native / any browser without the Notification API: nothing throws.
// ----------------------------------------------------------------------------

/** True only when running on web AND the browser exposes the Notification API. */
export const webNotificationsSupported: boolean = isWeb && typeof Notification !== 'undefined';

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Requests browser notification permission. Returns true iff permission is
 * (already, or newly) granted. Never throws — an unsupported browser or a
 * rejected/denied request both resolve to `false` so callers can treat this
 * as a plain feature check.
 */
export async function ensureWebNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/** Fires the actual browser notification. Split out from scheduleWebReminder
 * so the setTimeout callback is a single, easily-testable synchronous unit. */
function fireReminderNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  // Primary delivery: construct a Notification directly. Works immediately
  // while this tab is open, with no dependency on a service worker.
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body });
  } catch {
    // Best-effort — a background timer callback must never throw.
  }

  // Secondary, best-effort attempt: if a service worker is registered and
  // active, also ask it to show the notification via
  // ServiceWorkerRegistration.showNotification. This is fire-and-forget —
  // its failure (or absence) must never affect the primary path above, and
  // it does not itself guarantee closed-tab delivery.
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((registration) => registration?.showNotification?.(title, { body }))
        .catch(() => {});
    }
  } catch {
    // no-op
  }
}

/**
 * Schedules an in-session timer that fires a best-effort web `Notification`
 * at `fireAt` while the app is open. If `fireAt` is already in the past (or
 * very close), it fires soon (immediately) rather than being silently
 * skipped — a task saved with a reminder time that already slipped by still
 * gets a nudge instead of never firing. Unsupported browsers / no-op safely.
 */
export function scheduleWebReminder(reminder: { id: string; title: string; body: string; fireAt: number }): void {
  if (typeof Notification === 'undefined') return;

  cancelWebReminder(reminder.id);

  const delay = Math.max(0, reminder.fireAt - Date.now());
  const timer = setTimeout(() => {
    pendingTimers.delete(reminder.id);
    fireReminderNotification(reminder.title, reminder.body);
  }, delay);
  pendingTimers.set(reminder.id, timer);
}

/** Clears a pending web reminder timer scheduled via scheduleWebReminder. */
export function cancelWebReminder(id: string): void {
  const timer = pendingTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    pendingTimers.delete(id);
  }
}
