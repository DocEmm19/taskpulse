import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Chip, LabeledInput, PrimaryButton, SecondaryButton } from '../components/Common';
import { DateTimeField } from '../components/DateTimeField';
import { useLiveQuery } from '../db/useLiveQuery';
import { listCategories } from '../db/repositories/categories';
import { createTask, updateTask } from '../db/repositories/tasks';
import { getTaskFull } from '../db/repositories/taskFull';
import { createContact, linkContactToTask } from '../db/repositories/contacts';
import { addTaskEmail, addTaskLink, setTaskLocation, setTaskMeeting, setTravelPlan, addReminder } from '../db/repositories/taskExtras';
import { scheduleLocalReminder } from '../lib/notifications';
import { canUseLocalNotifications, isWeb } from '../lib/platform';
import { ensureWebNotificationPermission, scheduleWebReminder, webNotificationsSupported } from '../lib/webReminders';
import { colors, spacing, typography } from '../theme/theme';
import { CITY_OPTIONS, Priority } from '../types/models';

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
    if (!title.trim()) return Alert.alert('Task name is required');
    if (!categoryId) return Alert.alert('Please pick a category');
    setSaving(true);
    try {
      let taskId = editingTaskId!;
      if (isEdit) {
        await updateTask(taskId, {
          title,
          categoryId,
          priority,
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
      }

      if (expanded.has('contact') && contactName.trim()) {
        const contact = await createContact({ name: contactName, mobile: contactMobile || null, company: contactCompany || null });
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
      Alert.alert('Could not save task', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LabeledInput label="Task Name" required value={title} onChangeText={setTitle} placeholder="e.g. Client Payment Follow-up" />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipsWrap}>
        {categories.data?.map((c) => (
          <Chip key={c.id} label={c.name} selected={categoryId === c.id} color={c.color_hex} onPress={() => setCategoryId(c.id)} />
        ))}
      </View>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipsWrap}>
        {(['P1', 'P2', 'P3'] as Priority[]).map((p) => (
          <Chip key={p} label={p} selected={priority === p} onPress={() => setPriority(p)} />
        ))}
      </View>

      <LabeledInput label="Assigned To" value={assignedTo} onChangeText={setAssignedTo} placeholder="e.g. Rajni" />

      <DateTimeField label="Due Date" value={dueDate} onChange={setDueDate} mode="date" />
      {canUseLocalNotifications ? (
        <DateTimeField label="Reminder" value={reminderAt} onChange={setReminderAt} mode="datetime" placeholder="No reminder set" />
      ) : isWeb && webNotificationsSupported ? (
        <>
          <DateTimeField label="Reminder" value={reminderAt} onChange={setReminderAt} mode="datetime" placeholder="No reminder set" />
          <Text style={styles.hint}>Web reminders are best-effort and may not fire if this tab is closed (especially on iPhone).</Text>
        </>
      ) : (
        <Text style={styles.hint}>available in the phone app</Text>
      )}

      {!isEdit && (
        <LabeledInput label="Remarks" value={remark} onChangeText={setRemark} placeholder="Add an initial note (optional)" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      )}

      <Text style={styles.label}>Add more</Text>
      <View style={styles.chipsWrap}>
        {OPTIONAL_SECTIONS.map((s) => (
          <Chip key={s.key} label={`+ ${s.label}`} selected={expanded.has(s.key)} onPress={() => toggleSection(s.key)} />
        ))}
      </View>

      {expanded.has('contact') && (
        <View style={styles.subSection}>
          <LabeledInput label="Contact Name" value={contactName} onChangeText={setContactName} />
          <LabeledInput label="Mobile Number" value={contactMobile} onChangeText={setContactMobile} keyboardType="phone-pad" />
          <LabeledInput label="Company" value={contactCompany} onChangeText={setContactCompany} />
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
        <Text style={styles.hint}>Photos, PDFs, audio recordings and video can be added once the task is saved — open it from the task list.</Text>
      )}

      <PrimaryButton label={saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'} onPress={handleSave} disabled={saving} icon="checkmark" />
      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  label: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  subSection: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg, fontStyle: 'italic' },
});
