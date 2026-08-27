import { buildTaskEmail } from '../taskEmail';

describe('buildTaskEmail (Gmail-send Phase A compose link)', () => {
  test('full task: subject leads with priority code, body lists every field', () => {
    const { subject, body } = buildTaskEmail({
      title: 'Book flights to Mumbai',
      priorityLabel: 'P2 · Important',
      category: 'Travel',
      assigneeName: 'Gaurav',
      dueDateLabel: '05-Sep-2026',
      note: 'Prefer morning slots',
    });
    expect(subject).toBe('[P2] Book flights to Mumbai');
    expect(body).toContain('Hi Gaurav,');
    expect(body).toContain('Task: Book flights to Mumbai');
    expect(body).toContain('Priority: P2 · Important');
    expect(body).toContain('Category: Travel');
    expect(body).toContain('Due: 05-Sep-2026');
    expect(body).toContain('Note: Prefer morning slots');
    expect(body).toContain('— Sent from TaskPulse');
  });

  test('sparse task: missing fields are dropped, no stray labels or brackets', () => {
    const { subject, body } = buildTaskEmail({ title: 'Call vendor' });
    expect(subject).toBe('Call vendor'); // no priority → no [..] prefix
    expect(body).toContain('Hi,'); // no assignee → generic greeting
    expect(body).toContain('Task: Call vendor');
    expect(body).not.toContain('Priority:');
    expect(body).not.toContain('Category:');
    expect(body).not.toContain('Due:');
    expect(body).not.toContain('Note:');
  });

  test('whitespace-only fields are treated as absent', () => {
    const { subject, body } = buildTaskEmail({
      title: '   ',
      category: '   ',
      assigneeName: '  ',
    });
    expect(subject).toBe('Task'); // blank title falls back
    expect(body).toContain('Hi,');
    expect(body).not.toContain('Category:');
  });
});
