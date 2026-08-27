import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Chip, LabeledInput, PrimaryButton, SecondaryButton } from '../components/Common';
import { DateTimeField } from '../components/DateTimeField';
import { AttachmentsSection, PendingAttachment } from '../components/AttachmentsSection';
import { useLiveQuery } from '../db/useLiveQuery';
import { listCategories, canonicalCategoryId } from '../db/repositories/categories';
import { createTask, updateTask } from '../db/repositories/tasks';
import { addAttachment } from '../db/repositories/attachments';
import { getTaskFull } from '../db/repositories/taskFull';
import { createContact, linkContactToTask } from '../db/repositories/contacts';
import { addTaskEmail, addTaskLink, setTaskLocation, setTaskMeeting, setTravelPlan, addReminder } from '../db/repositories/taskExtras';
import { scheduleLocalReminder } from '../lib/notifications';
import { canUseLocalNotifications, isWeb } from '../lib/platform';
import { ensureWebNotificationPermission, scheduleWebReminder, webNotificationsSupported } from '../lib/webReminders';
import { colors, fieldAccents, priorityMeta, radius, spacing, typography } from '../theme/theme';
import { CITY_OPTIONS, Priority } from '../types/models';

// Two-column on tablet/desktop widths, single column on phone-sized viewports.
const WIDE_BREAKPOINT = 700;

// react-native-web's Alert.alert is a no-op stub (confirmed: it renders
// nothing and never invokes any button callback) — see TaskDetailScreen's
// identical webAlert() helper and comment. Without this, any validation
// failure or thrown error in handleSave() below is completely invisible on
// web: the button click "does nothing" from the user's point of view, even
// though a real problem (missing field, thrown exception) occurred.
function webAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

type Section = 'contact' | 'email' | 'website' | 'meeting_link' | 'location' | 'meeting' | 'travel' | 'booking';
const OPTIONAL_SECTIONS: Array<{ key: Section; label: string; icon: string }> = [
  { key: 'booking', label: 'Booking request', icon: 'cart-outline' },
  { key: 'contact', label: 'Contact', icon: 'person-add-outline' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
  { key: 'website', label: 'Website', icon: 'link-outline' },
  { key: 'meeting_link', label: 'Meeting', icon: 'videocam-outline' },
  { key: 'location', label: 'Location', icon: 'location-outline' },
  { key: 'meeting', label: 'Schedule', icon: 'time-outline' },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
];

// What Gaurav most often books — surfaced as quick toggles inside Travel.
const TRAVEL_BOOKINGS = ['Flights', 'Hotel', 'Taxi', 'Meetings'];

export function NewEditTaskScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editingTaskId: string | undefined = route.params?.taskId;
  const presetCategory: string | undefined = route.params?.presetCategory;
  const isEdit = Boolean(editingTaskId);
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const categories = useLiveQuery('task_categories', listCategories);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('P2');
  const [assignedTo, setAssignedTo] = useState(isEdit ? '' : 'Gaurav'); // default assignee
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [reminderAt, setReminderAt] = useState<Date | null>(null);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<Section>>(new Set());
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // optional section fields
  const [contactName, setContactName] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [website, setWebsite] = useState('');
  const [meetingLinkUrl, setMeetingLinkUrl] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStart, setMeetingStart] = useState<Date | null>(null);
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [travelDate, setTravelDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [purpose, setPurpose] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [bookingNote, setBookingNote] = useState('');
  const [travelBookings, setTravelBookings] = useState<Set<string>>(new Set());

  function toggleTravelBooking(item: string) {
    setTravelBookings((prev) => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  }

  const selectedCategoryName = categories.data?.find((c) => c.id === categoryId)?.name;
  const isTravelCategory = selectedCategoryName === 'Travel';

  useEffect(() => {
    if (!categories.data || categories.data.length === 0) return;
    if (categoryId) return;
    const preset = presetCategory ? categories.data.find((c) => c.name === presetCategory) : null;
    setCategoryId((preset ?? categories.data[0]).id);
  }, [categories.data]);

  useEffect(() => {
    if (isTravelCategory) setExpanded((s) => new Set([...s, 'travel']));
  }, [isTravelCategory]);

  useEffect(() => {
    if (!editingTaskId) return;
    getTaskFull(editingTaskId).then(async (full) => {
      if (!full) return;
      setTitle(full.task.title);
      // Normalise to the category the deduped picker actually shows for this
      // name — a synced task may reference a duplicate default that
      // listCategories() hides, which would otherwise leave no chip highlighted.
      setCategoryId(await canonicalCategoryId(full.task.category_id));
      setPriority(full.task.priority);
      setAssignedTo(full.task.assigned_to_name ?? '');
      setAssigneeEmail(full.task.assigned_to_email ?? '');
      setDueDate(full.task.due_date ? new Date(full.task.due_date) : null);
      setReminderAt(full.task.reminder_at ? new Date(full.task.reminder_at) : null);
      if (full.travel) {
        setExpanded((s) => new Set([...s, 'travel']));
        setCity(CITY_OPTIONS.includes(full.travel!.city) ? full.travel!.city : 'Other');
        setCustomCity(CITY_OPTIONS.includes(full.travel!.city) ? '' : full.travel!.city);
        setTravelDate(new Date(full.travel.travel_date));
        setReturnDate(full.travel.return_date ? new Date(full.travel.return_date) : null);
        setPurpose(full.travel.purpose ?? '');
        setHotelName(full.travel.hotel_name ?? '');
      }
    });
  }, [editingTaskId]);

  function toggleSection(key: Section) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) return webAlert('Task name is required');
    if (!categoryId) return webAlert('Please pick a category');
    setSaving(true);
    try {
      let taskId = editingTaskId!;
      if (isEdit) {
        await updateTask(taskId, {
          title,
          categoryId,
          priority,
          assignedToName: assignedTo || null,
          assignedToEmail: assigneeEmail.trim() || null,
          dueDate: dueDate ? dueDate.toISOString() : null,
          reminderAt: reminderAt ? reminderAt.toISOString() : null,
        });
      } else {
        // Fold the free-text remark, a booking request, and any travel "to book"
        // toggles into the task's first note so they persist and sync (no extra
        // schema needed — the assistant sees them right on the task).
        const noteLines: string[] = [];
        if (remark.trim()) noteLines.push(remark.trim());
        if (expanded.has('booking') && bookingNote.trim()) noteLines.push(`Booking request: ${bookingNote.trim()}`);
        if (expanded.has('travel')) {
          const toBook = TRAVEL_BOOKINGS.filter((b) => travelBookings.has(b));
          if (toBook.length) noteLines.push(`To book: ${toBook.join(', ')}`);
        }
        const created = await createTask({
          title,
          categoryId,
          priority,
          assignedToName: assignedTo || null,
          assignedToEmail: assigneeEmail.trim() || null,
          dueDate: dueDate ? dueDate.toISOString() : null,
          reminderAt: reminderAt ? reminderAt.toISOString() : null,
          initialRemark: noteLines.length ? noteLines.join('\n') : null,
        });
        taskId = created.id;

        // Attachments picked before the task existed (see AttachmentsSection
        // "pending" mode below) — commit each to the newly-created task now.
        for (const p of pendingAttachments) {
          await addAttachment({
            taskId,
            fileType: p.fileType,
            fileName: p.fileName,
            localPath: p.localPath,
            fileSizeBytes: p.fileSizeBytes ?? null,
            mimeType: p.mimeType ?? null,
            durationSeconds: p.durationSeconds ?? null,
          });
        }
      }

      // "Company" is now always visible on the main form (not gated behind
      // "+ Contact" like Contact Name/Mobile still are), so a contact record
      // Create a contact only at task-creation time, and only when the user
      // EXPLICITLY entered a contact name or company. Previously this also fell
      // back to "Assigned To" and ran on every save (edit included) — so with
      // Assigned-To now defaulting to "Gaurav", every task/edit spawned a
      // duplicate "Gaurav" contact. Assignee is not a contact; don't conflate.
      const contactNameFinal = contactName.trim();
      if (!isEdit && (contactNameFinal || contactCompany.trim())) {
        const contact = await createContact({
          name: contactNameFinal || contactCompany.trim(),
          mobile: contactMobile || null,
          company: contactCompany || null,
        });
        await linkContactToTask(taskId, contact.id);
      }
      if (expanded.has('email') && emailAddress.trim()) {
        await addTaskEmail(taskId, emailAddress, emailSubject || null);
      }
      if (expanded.has('website') && website.trim()) {
        await addTaskLink(taskId, 'website', website);
      }
      if (expanded.has('meeting_link') && meetingLinkUrl.trim()) {
        const type = meetingLinkUrl.includes('meet.google') ? 'meeting_google_meet' : meetingLinkUrl.includes('teams') ? 'meeting_teams' : meetingLinkUrl.includes('zoom') ? 'meeting_zoom' : 'meeting_other';
        await addTaskLink(taskId, type, meetingLinkUrl);
      }
      if (expanded.has('location') && (locationLabel.trim() || mapsUrl.trim())) {
        await setTaskLocation(taskId, { label: locationLabel || null, mapsUrl: mapsUrl || null });
      }
      if (expanded.has('meeting') && meetingTitle.trim() && meetingStart) {
        await setTaskMeeting(taskId, { title: meetingTitle, startTime: meetingStart.toISOString(), meetingLink: meetingLinkUrl || null, location: locationLabel || null });
      }
      if (expanded.has('travel') && travelDate) {
        const finalCity = city === 'Other' ? customCity : city;
        if (finalCity) {
          await setTravelPlan(taskId, {
            city: finalCity,
            travelDate: travelDate.toISOString(),
            returnDate: returnDate ? returnDate.toISOString() : null,
            purpose: purpose || null,
            hotelName: hotelName || null,
          });
        }
      }

      if (canUseLocalNotifications && reminderAt) {
        const notifId = await scheduleLocalReminder('Task reminder', title, reminderAt);
        await addReminder(taskId, reminderAt.toISOString(), title, notifId);
      } else if (isWeb && webNotificationsSupported && reminderAt) {
        // Best-effort web path (Task 17A) — see the honest caveat rendered
        // next to the reminder field below. Reminder id keyed on the task so
        // re-saving with a new time replaces rather than duplicates the timer.
        // Fire-and-forget the permission prompt. Awaiting it blocked the entire
        // save — the "Create Task"/"Save" button sat on "Saving…" until the user
        // answered the browser's notification prompt, and indefinitely if they
        // dismissed/ignored it. Web reminders are best-effort anyway (see the
        // caveat rendered next to the field), and the timer scheduled below only
        // needs permission by the time it actually fires (in the future), so the
        // grant resolving a moment later is fine.
        void ensureWebNotificationPermission();
        scheduleWebReminder({ id: `task:${taskId}`, title: 'Task reminder', body: title, fireAt: reminderAt.getTime() });
        await addReminder(taskId, reminderAt.toISOString(), title, null);
      }

      navigation.replace('TaskDetail', { taskId });
    } catch (e) {
      // Previously this failure was reported via Alert.alert, which is a
      // no-op on web — so any exception here (a thrown error saving the
      // task, committing a pending attachment, etc.) looked exactly like
      // "Create Task does nothing" with zero feedback.
      webAlert('Could not save task', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  // Compact header action (desktop/tablet especially) so Create Task /
  // Save Changes doesn't require scrolling to the bottom of a long form.
  // Keep a ref to the latest handleSave so the header button never fires a
  // stale closure. Previously the header's onPress captured whatever handleSave
  // existed when setOptions last ran, and the dep array didn't list every field
  // (assignee email, booking note, travel toggles, add-more fields) — so a value
  // typed just before tapping the header button could be silently dropped. The
  // ref is reassigned every render, so onPress always calls the current save.
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // The full-width button at the bottom of the form is left in place too —
  // this is purely additive, same handleSave, same disabled/label logic.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: spacing.md }}>
          <SecondaryButton
            label={saving ? 'Saving...' : isEdit ? 'Save' : 'Create Task'}
            icon="checkmark-circle"
            onPress={() => handleSaveRef.current()}
          />
        </View>
      ),
    });
  }, [navigation, saving, isEdit]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.formShell}>
        <Row isWide={isWide}>
          <Field flex={1.4}>
            <LabeledInput
              label="Task Name"
              required
              icon="pricetag-outline"
              accentColor={fieldAccents.title.color}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Client Payment Follow-up"
            />
          </Field>
          <Field flex={1}>
            <FieldLabel icon="flag-outline" color={fieldAccents.priority.color} text="Priority" />
            <View style={styles.chipsWrap}>
              {(['P1', 'P2', 'P3'] as Priority[]).map((p) => (
                <Chip key={p} label={priorityMeta[p].label.split(' · ')[0]} selected={priority === p} color={priorityMeta[p].color} onPress={() => setPriority(p)} />
              ))}
            </View>
          </Field>
        </Row>

        <View style={styles.compactRow}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipsWrap}>
            {categories.data?.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} color={c.color_hex} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
        </View>

        {!isEdit && (
          <AttachmentsSection
            taskId={null}
            attachments={[]}
            pendingAttachments={pendingAttachments}
            onPendingAttachmentsChange={setPendingAttachments}
          />
        )}

        <Text style={styles.label}>Add more</Text>
        <View style={styles.chipsWrap}>
          {OPTIONAL_SECTIONS.map((s) => (
            <Chip key={s.key} label={`+ ${s.label}`} selected={expanded.has(s.key)} onPress={() => toggleSection(s.key)} />
          ))}
        </View>

        {expanded.has('booking') && (
          <View style={styles.subSection}>
            <LabeledInput
              label="What to book"
              value={bookingNote}
              onChangeText={setBookingNote}
              placeholder="e.g. Flight to Mumbai 12 Sep morning, cab to airport"
              multiline
              numberOfLines={2}
              style={{ minHeight: 64, textAlignVertical: 'top' }}
            />
          </View>
        )}
        {expanded.has('contact') && (
          <View style={styles.subSection}>
            <LabeledInput label="Contact Name" value={contactName} onChangeText={setContactName} placeholder="Optional — defaults to Assigned To" />
            <LabeledInput label="Mobile Number" value={contactMobile} onChangeText={setContactMobile} keyboardType="phone-pad" />
          </View>
        )}
        {expanded.has('email') && (
          <View style={styles.subSection}>
            <LabeledInput label="Email Address" value={emailAddress} onChangeText={setEmailAddress} keyboardType="email-address" autoCapitalize="none" />
            <LabeledInput label="Subject" value={emailSubject} onChangeText={setEmailSubject} />
          </View>
        )}
        {expanded.has('website') && (
          <View style={styles.subSection}>
            <LabeledInput label="Website Link" value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://" />
          </View>
        )}
        {expanded.has('meeting_link') && (
          <View style={styles.subSection}>
            <LabeledInput label="Meeting Link (Meet / Teams / Zoom)" value={meetingLinkUrl} onChangeText={setMeetingLinkUrl} autoCapitalize="none" />
          </View>
        )}
        {expanded.has('location') && (
          <View style={styles.subSection}>
            <LabeledInput label="Location Label" value={locationLabel} onChangeText={setLocationLabel} placeholder="e.g. Client Office – Gurgaon" />
            <LabeledInput label="Google Maps Link" value={mapsUrl} onChangeText={setMapsUrl} autoCapitalize="none" />
          </View>
        )}
        {expanded.has('meeting') && (
          <View style={styles.subSection}>
            <LabeledInput label="Meeting Title" value={meetingTitle} onChangeText={setMeetingTitle} />
            <DateTimeField label="Meeting Time" value={meetingStart} onChange={setMeetingStart} mode="datetime" />
          </View>
        )}
        {expanded.has('travel') && (
          <View style={styles.subSection}>
            <Text style={styles.label}>To book</Text>
            <View style={styles.chipsWrap}>
              {TRAVEL_BOOKINGS.map((b) => (
                <Chip key={b} label={b} selected={travelBookings.has(b)} onPress={() => toggleTravelBooking(b)} />
              ))}
            </View>
            <Text style={styles.label}>City</Text>
            <View style={styles.chipsWrap}>
              {CITY_OPTIONS.map((c) => (
                <Chip key={c} label={c} selected={city === c} onPress={() => setCity(c)} />
              ))}
            </View>
            {city === 'Other' && <LabeledInput label="Enter City" value={customCity} onChangeText={setCustomCity} />}
            <DateTimeField label="Travel Date" value={travelDate} onChange={setTravelDate} mode="date" />
            <DateTimeField label="Return Date" value={returnDate} onChange={setReturnDate} mode="date" />
            <LabeledInput label="Purpose" value={purpose} onChangeText={setPurpose} />
            <LabeledInput label="Hotel" value={hotelName} onChangeText={setHotelName} />
          </View>
        )}

        <Row isWide={isWide}>
          <Field flex={1}>
            <LabeledInput
              label="Assigned To"
              icon="person-outline"
              accentColor={fieldAccents.assignedTo.color}
              value={assignedTo}
              onChangeText={setAssignedTo}
              placeholder="e.g. Rajni"
            />
          </Field>
          <Field flex={1}>
            <LabeledInput
              label="Company"
              icon="business-outline"
              accentColor={fieldAccents.company.color}
              value={contactCompany}
              onChangeText={setContactCompany}
              placeholder="e.g. Redcliffe Labs"
            />
          </Field>
        </Row>

        <LabeledInput
          label="Assignee Email (optional)"
          icon="at-outline"
          accentColor={fieldAccents.assignedTo.color}
          value={assigneeEmail}
          onChangeText={setAssigneeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@company.com — used to email the task later"
        />

        <Row isWide={isWide}>
          <Field flex={1}>
            <DateTimeField label="Due Date" value={dueDate} onChange={setDueDate} mode="date" accentColor={fieldAccents.dueDate.color} />
          </Field>
          <Field flex={1}>
            {canUseLocalNotifications ? (
              <DateTimeField label="Self Reminder" value={reminderAt} onChange={setReminderAt} mode="datetime" placeholder="No reminder set" accentColor={fieldAccents.reminder.color} />
            ) : isWeb && webNotificationsSupported ? (
              <>
                <DateTimeField label="Self Reminder" value={reminderAt} onChange={setReminderAt} mode="datetime" placeholder="No reminder set" accentColor={fieldAccents.reminder.color} />
                <Text style={styles.hint}>Web reminders are best-effort and may not fire if this tab is closed (especially on iPhone).</Text>
              </>
            ) : (
              <Text style={styles.hint}>available in the phone app</Text>
            )}
          </Field>
        </Row>

        {!isEdit && (
          <LabeledInput
            label="Remarks"
            value={remark}
            onChangeText={setRemark}
            placeholder="Add an initial note (optional)"
            multiline
            numberOfLines={2}
            style={{ minHeight: 76, textAlignVertical: 'top' }}
          />
        )}

        <PrimaryButton label={saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'} onPress={handleSave} disabled={saving} icon="checkmark" />
        <View style={{ height: spacing.xxxl }} />
      </View>
    </ScrollView>
  );
}

/** Two-column on wide viewports (desktop/tablet), stacked on narrow ones
 * (phone) — the same component renders both; only the flex direction
 * changes based on measured window width. This is the core building block
 * for the compact grid (Task Name/Priority, Assigned To/Company, Due
 * Date/Reminder). */
function Row({ isWide, children }: { isWide: boolean; children: React.ReactNode }) {
  return <View style={[styles.row, { flexDirection: isWide ? 'row' : 'column' }]}>{children}</View>;
}

/** Plain flex column wrapper for one field within a Row — no visual styling
 * of its own. Each field's own component (LabeledInput/DateTimeField) now
 * carries its own subtle accent (icon + tinted label + thin left border)
 * directly, so this wrapper only needs to control width distribution. */
function Field({ flex, children }: { flex: number; children: React.ReactNode }) {
  return <View style={{ flex }}>{children}</View>;
}

/** Compact label row with a small colored icon — used for the Priority
 * chips, which (unlike LabeledInput) don't have a built-in label. */
function FieldLabel({ icon, color, text }: { icon: any; color?: string; text: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      {color ? <Ionicons name={icon} size={13} color={color} /> : null}
      <Text style={[styles.label, color ? { color, marginBottom: 0 } : null]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered, width-capped shell — a clean corporate-form width on desktop
  // rather than fields stretching edge-to-edge across a wide window; on
  // narrow viewports width is simply 100% since maxWidth never binds.
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },
  formShell: { width: '100%', maxWidth: 1040 },
  row: { gap: spacing.md, marginBottom: spacing.md },
  compactRow: { marginBottom: spacing.md },
  label: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subSection: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm, fontStyle: 'italic' },
});
