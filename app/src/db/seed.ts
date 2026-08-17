import { getDb, getMeta, setMeta } from './database';
import { newId } from '../lib/uuid';
import { ensureDefaultCategories, listCategories } from './repositories/categories';
import { createTask, reassignTask, updateTask, addRemark } from './repositories/tasks';
import { createContact, linkContactToTask } from './repositories/contacts';
import { addTaskEmail, addTaskLink, setTaskLocation, setTaskMeeting, setTravelPlan, addCalendarEvent } from './repositories/taskExtras';
import { notifyTablesChanged } from './events';

const SEED_FLAG = 'demo_seed_v1';

function daysAgoIso(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function daysFromNowIso(days: number, hour = 15): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * Populates realistic demo data matching the examples in the product spec, so
 * the app is immediately useful to explore. Runs exactly once (guarded by
 * app_meta) — safe to call on every launch.
 */
export async function seedDemoDataIfNeeded(): Promise<void> {
  await ensureDefaultCategories();
  const already = await getMeta(SEED_FLAG);
  if (already) return;

  const categories = await listCategories();
  const byName = (n: string) => categories.find((c) => c.name === n)!.id;

  // Contacts
  const rajni = await createContact({ name: 'Rajni', mobile: '+91 98100 11223', company: 'ABC Ltd', designation: 'Accounts Manager' });
  const mohit = await createContact({ name: 'Mohit', mobile: '+91 98111 44556', company: 'Redcliffe Labs', designation: 'Sales Executive' });
  const raman = await createContact({ name: 'Raman', mobile: '+91 98222 77889', company: 'Redcliffe Labs', designation: 'Field Executive' });
  const clientMumbai = await createContact({ name: 'Mr. Kapoor', mobile: '+91 98333 22110', company: 'Kapoor Diagnostics', designation: 'Director' });

  // 1. Client Payment Follow-up — Official, P1, overdue-ish example
  const payment = await createTask({
    title: 'Client Payment Follow-up',
    categoryId: byName('Official'),
    priority: 'P1',
    assignedToName: 'Rajni',
    dueDate: daysFromNowIso(0),
    initialRemark: 'Payment commitment received from client.',
  });
  await linkContactToTask(payment.id, rajni.id);
  await addTaskEmail(payment.id, 'finance@abcltd.com', 'Pending Invoice #4521', 'Please clear the pending balance at the earliest.');
  await addRemark(payment.id, 'Payment not received.');
  await addRemark(payment.id, 'Reminder sent to finance team.');

  // 2. Mumbai Client Meeting — Travel, P1, full example from spec
  const mumbai = await createTask({
    title: 'Mumbai Client Meeting',
    categoryId: byName('Travel'),
    priority: 'P1',
    assignedToName: 'Gaurav',
    dueDate: daysFromNowIso(2, 18),
    initialRemark: 'Finalize payment discussion.',
  });
  await linkContactToTask(mumbai.id, clientMumbai.id);
  await setTravelPlan(mumbai.id, {
    city: 'Mumbai',
    travelDate: daysFromNowIso(2, 9),
    returnDate: daysFromNowIso(3, 20),
    purpose: 'Client meeting — payment discussion',
    hotelName: 'Hotel Sea Pearl, Andheri East',
  });
  await setTaskMeeting(mumbai.id, {
    title: 'Client Office Meeting',
    startTime: daysFromNowIso(2, 15),
    endTime: daysFromNowIso(2, 16),
    location: 'Kapoor Diagnostics, Andheri East',
  });
  await setTaskLocation(mumbai.id, { label: 'Client Office – Andheri East', mapsUrl: 'https://maps.google.com/?q=Andheri+East+Mumbai' });
  await addTaskLink(mumbai.id, 'website', 'https://kapoordiagnostics.example.com');

  // 3. Reassignment example task
  const reassignExample = await createTask({
    title: 'Prepare Client Discussion Notes',
    categoryId: byName('Official'),
    priority: 'P2',
    assignedToName: 'Raman',
    dueDate: daysFromNowIso(1),
  });
  await linkContactToTask(reassignExample.id, raman.id);
  await reassignTask(reassignExample.id, { toName: 'Mohit', reason: 'Client discussion required', remark: 'Please close before Monday' });

  // 4. Overdue example
  const overdueTask = await createTask({
    title: 'Vendor Agreement Signature',
    categoryId: byName('Official'),
    priority: 'P1',
    assignedToName: 'Finance Team',
    dueDate: daysAgoIso(3),
  });
  await addRemark(overdueTask.id, 'Waiting on legal review.');

  // 5. Personal task
  await createTask({
    title: "Abhay's Passport Renewal Appointment",
    categoryId: byName('Personal'),
    priority: 'P2',
    assignedToName: 'Gaurav',
    dueDate: daysFromNowIso(5),
  });

  // 6. Urgent task, due today
  const urgent = await createTask({
    title: 'Send Signed Contract to Legal',
    categoryId: byName('Urgent'),
    priority: 'P1',
    assignedToName: 'Gaurav',
    dueDate: daysFromNowIso(0, 17),
  });
  await addTaskLink(urgent.id, 'website', 'https://drive.example.com/contract-final.pdf', 'Signed Contract');

  // 7. In progress example
  const inProgress = await createTask({
    title: 'Quarterly Report Compilation',
    categoryId: byName('Official'),
    priority: 'P3',
    assignedToName: 'Mohit',
    dueDate: daysFromNowIso(4),
  });
  await updateTask(inProgress.id, { status: 'in_progress' });

  // 8. Completed example (so status filters have something to show)
  const done = await createTask({
    title: 'Book Cab for Airport Pickup',
    categoryId: byName('Travel'),
    priority: 'P3',
    assignedToName: 'Gaurav',
    dueDate: daysAgoIso(1),
  });
  await updateTask(done.id, { status: 'completed' });

  // 9. Meeting-only entries for Today view / Calendar tab
  await addCalendarEvent({
    title: 'Internal Finance Meeting',
    startTime: (() => { const d = new Date(); d.setHours(10, 0, 0, 0); return d.toISOString(); })(),
    endTime: (() => { const d = new Date(); d.setHours(10, 30, 0, 0); return d.toISOString(); })(),
    location: 'Office Conference Room',
    provider: 'device',
  });
  await addCalendarEvent({
    title: 'Client Call',
    startTime: (() => { const d = new Date(); d.setHours(12, 30, 0, 0); return d.toISOString(); })(),
    endTime: (() => { const d = new Date(); d.setHours(13, 0, 0, 0); return d.toISOString(); })(),
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    provider: 'device',
  });
  await addCalendarEvent({
    title: 'Abhay Singavi — 1:1',
    startTime: (() => { const d = new Date(); d.setHours(15, 0, 0, 0); return d.toISOString(); })(),
    endTime: (() => { const d = new Date(); d.setHours(15, 30, 0, 0); return d.toISOString(); })(),
    location: 'Cabin',
    provider: 'device',
  });

  await setMeta(SEED_FLAG, new Date().toISOString());
  notifyTablesChanged(['tasks', 'task_activity', 'contacts', 'meetings', 'calendar_events', 'travel_plans']);
}
