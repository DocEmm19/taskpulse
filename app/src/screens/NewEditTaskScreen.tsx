import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Chip, LabeledInput, PrimaryButton, SecondaryButton } from '../components/Common';
import { DateTimeField } from '../components/DateTimeField';
import { AttachmentsSection, PendingAttachment } from '../components/AttachmentsSection';
import { useLiveQuery } from '../db/useLiveQuery';
import { listCategories } from '../db/repositories/categories';
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

type Section = 'contact' | 'email' | 'website' | 'meeting_link' | 'location' | 'meeting' | 'travel';
const OPTIONAL_SECTIONS: Array<{ key: Section; label: string; icon: string }> = [
  { key: 'contact', label: 'Contact', icon: 'person-add-outline' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
  { key: 'website', label: 'Website', icon: 'link-outline' },
  { key: 'meeting_link', label: 'Meeting', icon: 'videocam-outline' },
  { key: 'location', label: 'Location', icon: 'location-outline' },
  { key: 'meeting', label: 'Schedule', icon: 'time-outline' },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
];

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
  const [assignedTo, setAssignedTo] = useState('');
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
    getTaskFull(editingTaskId).then((full) => {
      if (!full) return;
      setTitle(full.task.title);
      setCategoryId(full.task.category_id);
      setPriority(full.task.priority);
      setAssignedTo(full.task.assigned_to_name ?? '');
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
          dueDate: dueDate ? dueDate.toISOString() : null,
          reminderAt: reminderAt ? reminderAt.toISOString() : null,
        });
      } else {
        const created = await createTask({
          title,
          categoryId,
          priority,
          assignedToName: assignedTo || null,
          dueDate: dueDate ? dueDate.toISOString() : null,
          reminderAt: reminderAt ? reminderAt.toISOString() : null,
          initialRemark: remark || null,
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
      // is created whenever there's anything to save on it: an explicit
      // Contact Name (from the optional section), or just a Company — in
      // which case we fall back to "Assigned To" as the contact's name
      // since that's who the company is associated with on this task.
      const contactNameFinal = contactName.trim() || assignedTo.trim();
      if (contactNameFinal || contactCompany.trim()) {
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
        await ensureWebNotificationPermission();
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
  // The full-width button at the bottom of the form is left in place too —
  // this is purely additive, same handleSave, same disabled/label logic.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: spacing.md }}>
          <SecondaryButton
            label={saving ? 'Saving...' : isEdit ? 'Save' : 'Create Task'}
            icon="checkmark-circle"
            onPress={handleSave}
          />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, saving, isEdit, title, categoryId, priority, assignedTo, dueDate, reminderAt, remark, contactCompany, contactName, contactMobile, pendingAttachments]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.formShell}>
        <Row isWide={isWide}>
          <Field flex={1.4} accent={fieldAccents.title} icon="pricetag-outline" accentLabel="Task">
            <LabeledInput label="Task Name" required value={title} onChangeText={setTitle} placeholder="e.g. Client Payment Follow-up" style={accentedInput(fieldAccents.title)} />
          </Field>
          <Field flex={1} accent={fieldAccents.priority} icon="flag-outline" accentLabel="Priority">
            <Text style={styles.label}>Priority</Text>
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

        <Row isWide={isWide}>
          <Field flex={1} accent={fieldAccents.assignedTo} icon="person-outline" accentLabel="Assigned To">
            <LabeledInput label="Assigned To" value={assignedTo} onChangeText={setAssignedTo} placeholder="e.g. Rajni" style={accentedInput(fieldAccents.assignedTo)} />
          </Field>
          <Field flex={1} accent={fieldAccents.company} icon="business-outline" accentLabel="Company">
            <LabeledInput label="Company" value={contactCompany} onChangeText={setContactCompany} placeholder="e.g. Redcliffe Labs" style={accentedInput(fieldAccents.company)} />
          </Field>
        </Row>

        <Row isWide={isWide}>
          <Field flex={1} accent={fieldAccents.dueDate} icon="calendar-outline" accentLabel="Due Date">
            <DateTimeField label="Due Date" value={dueDate} onChange={setDueDate} mode="date" accentColor={fieldAccents.dueDate.color} accentSoft={fieldAccents.dueDate.soft} />
          </Field>
          <Field flex={1} accent={fieldAccents.reminder} icon="notifications-outline" accentLabel="Reminder">
            {canUseLocalNotifications ? (
              <DateTimeField label="Reminder" value={reminderAt} onChange={setReminderAt} mode="datetime" placeholder="No reminder set" accentColor={fieldAccents.reminder.color} accentSoft={fieldAccents.reminder.soft} />
            ) : isWeb && webNotificationsSupported ? (
              <>
                <DateTimeField label="Reminder" value={reminderAt} onChange={setReminderAt} mode="datetime" placeholder="No reminder set" accentColor={fieldAccents.reminder.color} accentSoft={fieldAccents.reminder.soft} />
                <Text style={styles.hint}>Web reminders are best-effort and may not fire if this tab is closed (especially on iPhone).</Text>
              </>
            ) : (
              <Text style={styles.hint}>available in the phone app</Text>
            )}
          </Field>
        </Row>

        {!isEdit && (
          <Field flex={1} accent={fieldAccents.remarks} icon="chatbox-ellipses-outline" accentLabel="Remarks" style={{ marginBottom: spacing.md }}>
            <LabeledInput label="Remarks" value={remark} onChangeText={setRemark} placeholder="Add an initial note (optional)" multiline numberOfLines={2} style={[accentedInput(fieldAccents.remarks), { minHeight: 64, textAlignVertical: 'top' }]} />
          </Field>
        )}

        <Text style={styles.label}>Add more</Text>
        <View style={styles.chipsWrap}>
          {OPTIONAL_SECTIONS.map((s) => (
            <Chip key={s.key} label={`+ ${s.label}`} selected={expanded.has(s.key)} onPress={() => toggleSection(s.key)} />
          ))}
        </View>

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

        {!isEdit && (
          <AttachmentsSection
            taskId={null}
            attachments={[]}
            pendingAttachments={pendingAttachments}
            onPendingAttachmentsChange={setPendingAttachments}
          />
        )}

        <PrimaryButton label={saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'} onPress={handleSave} disabled={saving} icon="checkmark" />
        <View style={{ height: spacing.xxxl }} />
      </View>
    </ScrollView>
  );
}

/** Two-column on wide viewports, stacked on narrow ones — the core building
 * block for the compact desktop grid (Title/Priority, Assigned To/Company,
 * Due Date/Reminder). */
function Row({ isWide, children }: { isWide: boolean; children: React.ReactNode }) {
  return <View style={[styles.row, { flexDirection: isWide ? 'row' : 'column' }]}>{children}</View>;
}

/** Wraps a single field with its subtle colored accent — a thin left border
 * + very light tinted background, kept restrained per field-group (title
 * blue, priority amber, assigned-to purple, company green, due-date indigo,
 * reminder teal, remarks neutral). The wrapped field's own component
 * (LabeledInput/Chip/DateTimeField) is unchanged; this is a plain wrapper. */
function Field({
  flex,
  accent,
  icon,
  accentLabel,
  children,
  style,
}: {
  flex: number;
  accent: { color: string; soft: string };
  icon: any;
  accentLabel: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[styles.fieldGroup, { flex, backgroundColor: accent.soft, borderLeftColor: accent.color }, style]}>
      <View style={styles.fieldGroupTag}>
        <Ionicons name={icon} size={12} color={accent.color} />
        <Text style={[styles.fieldGroupTagText, { color: accent.color }]}>{accentLabel}</Text>
      </View>
      {children}
    </View>
  );
}

/** Returns a style object (not part of StyleSheet.create since it's
 * parameterized per field) that tints a LabeledInput's own input box with a
 * field's accent — thin colored left border + very light tinted background.
 * The input's existing border/radius/padding are untouched. */
function accentedInput(accent: { color: string; soft: string }) {
  return { borderLeftWidth: 3, borderLeftColor: accent.color, backgroundColor: accent.soft } as const;
}

const styles = StyleSheet.create({
  // Centered, width-capped shell so the two-column desktop grid stays
  // readable on very wide windows instead of stretching edge-to-edge.
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, alignItems: 'center' },
  formShell: { width: '100%', maxWidth: 780 },
  row: { gap: spacing.md, marginBottom: spacing.md },
  compactRow: { marginBottom: spacing.md },
  label: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subSection: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md, fontStyle: 'italic' },
  fieldGroup: { borderRadius: radius.md, borderLeftWidth: 3, padding: spacing.sm, paddingTop: spacing.xs },
  fieldGroupTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  fieldGroupTagText: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.3 },
});
