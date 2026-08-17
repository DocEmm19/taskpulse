import * as Calendar from 'expo-calendar';
import { Linking, Platform } from 'react-native';

/** Adds an event to whatever calendar app is already on the phone (Req. #21).
 * This intentionally does NOT re-implement a calendar — it hands off to
 * Google Calendar (Android) / Apple Calendar (iOS) via EventKit/CalendarProvider,
 * which is what expo-calendar wraps. */
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** expo-calendar has no web implementation at all (EventKit/CalendarProvider
 * are native-only) — there is no "the browser's calendar app" to hand off to.
 * The standard web-compatible fallback is a downloadable .ics file, which
 * every desktop/mobile calendar app (Google Calendar, Outlook, Apple
 * Calendar, etc.) can import. This keeps the native Android/iOS path
 * completely untouched. */
export function addEventToDeviceCalendarWeb(data: { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }): string {
  const escape = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/([,;])/g, '\\$1');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskPulse//Web//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.round(Math.random() * 1e6)}@taskpulse`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(data.startDate)}`,
    `DTEND:${icsDate(data.endDate)}`,
    `SUMMARY:${escape(data.title)}`,
    data.location ? `LOCATION:${escape(data.location)}` : null,
    data.notes ? `DESCRIPTION:${escape(data.notes)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.title.replace(/[^\w\-]+/g, '_').slice(0, 60) || 'event'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return `web-ics-${Date.now()}`;
}

/** Pure builder for the Google Calendar "quick add" template URL — no side
 * effects, so it's directly unit-testable. Matches the same parameter shape
 * used everywhere else in this file (`{ title, startDate, endDate, location?,
 * notes? }`). */
export function googleCalendarUrl(data: { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: data.title,
    dates: `${icsDate(data.startDate)}/${icsDate(data.endDate)}`,
  });
  if (data.notes) params.set('details', data.notes);
  if (data.location) params.set('location', data.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Primary Web "Add to Calendar" action: Google Calendar's "quick add" URL,
 * opened in a new tab, pre-filled with the event. This is Google-specific by
 * nature (there's no cross-provider "open a calendar action" API on the
 * web), which is exactly why `addEventToDeviceCalendarWeb` above stays
 * available as the secondary/fallback option for Outlook, Apple Calendar,
 * or anything else that can import an .ics file. */
export function openGoogleCalendarEvent(data: { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }): void {
  Linking.openURL(googleCalendarUrl(data));
}

export async function addEventToDeviceCalendar(data: {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
}): Promise<string | null> {
  if (Platform.OS === 'web') {
    return addEventToDeviceCalendarWeb(data);
  }

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return null;

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  let targetCalendar = calendars.find((c) => c.allowsModifications);

  if (!targetCalendar && Platform.OS === 'ios') {
    const defaultCal = await Calendar.getDefaultCalendarAsync();
    targetCalendar = defaultCal;
  }
  if (!targetCalendar && Platform.OS === 'android') {
    const source = { isLocalAccount: true, name: 'Task Manager', type: Calendar.SourceType.LOCAL } as any;
    const newCalId = await Calendar.createCalendarAsync({
      title: 'Task Manager',
      color: '#2452E8',
      entityType: Calendar.EntityTypes.EVENT,
      source,
      name: 'taskManagerCalendar',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    targetCalendar = { id: newCalId } as any;
  }
  if (!targetCalendar) return null;

  const eventId = await Calendar.createEventAsync(String(targetCalendar.id), {
    title: data.title,
    startDate: data.startDate,
    endDate: data.endDate,
    location: data.location,
    notes: data.notes,
  });
  return eventId;
}
