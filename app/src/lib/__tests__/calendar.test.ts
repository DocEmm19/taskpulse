import { googleCalendarUrl } from '../calendarIntegration';

test('builds a Google Calendar template URL', () => {
  const url = googleCalendarUrl({
    title: 'Sync',
    startDate: new Date('2026-08-20T10:00:00Z'),
    endDate: new Date('2026-08-20T11:00:00Z'),
  });

  expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
  expect(url).toContain('text=Sync');
  expect(url).toContain('dates=20260820T100000Z%2F20260820T110000Z');
});
