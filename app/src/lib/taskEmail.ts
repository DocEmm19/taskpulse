// Gmail-send, Phase A ("compose link"): rather than send server-side (no backend)
// or via the Gmail API (per-user OAuth), we hand the task to the sender's own mail
// app pre-filled — so it goes out from whoever is signed in (Gaurav or Abhay),
// from their real address, with one tap. This builds the subject + body; the
// screen passes them to openEmail() in actions.ts.
//
// Deliberately a LEAF module with zero imports (no react-native, no AsyncStorage
// chain) so it stays trivially unit-testable. Empty/whitespace fields are dropped
// so the email never shows a stray "Category:" with nothing after it.
export function buildTaskEmail(input: {
  title: string;
  priorityLabel?: string | null; // e.g. "P2 · Important"
  category?: string | null;
  assigneeName?: string | null;
  dueDateLabel?: string | null; // pre-formatted (e.g. "05-Sep-2026")
  note?: string | null; // latest remark, optional
}): { subject: string; body: string } {
  const clean = (v?: string | null) => (v && v.trim() ? v.trim() : undefined);
  const title = clean(input.title) ?? 'Task';
  const priorityLabel = clean(input.priorityLabel);
  const category = clean(input.category);
  const assignee = clean(input.assigneeName);
  const due = clean(input.dueDateLabel);
  const note = clean(input.note);

  const lines: string[] = [assignee ? `Hi ${assignee},` : 'Hi,', '', 'Please action the following task:', '', `Task: ${title}`];
  if (priorityLabel) lines.push(`Priority: ${priorityLabel}`);
  if (category) lines.push(`Category: ${category}`);
  if (due) lines.push(`Due: ${due}`);
  if (note) lines.push('', `Note: ${note}`);
  lines.push('', '— Sent from TaskPulse');

  // Subject leads with the priority code ("P2") when present — scannable in an inbox.
  const code = priorityLabel ? priorityLabel.split(/\s/)[0] : undefined;
  const subject = code ? `[${code}] ${title}` : title;
  return { subject, body: lines.join('\n') };
}
