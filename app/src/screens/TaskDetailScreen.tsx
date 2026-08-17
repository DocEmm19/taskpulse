import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ScreenContainer, IconTextRow, LabeledInput, Loading, PrimaryButton, SecondaryButton, SectionCard } from '../components/Common';
import { PriorityBadge, StatusBadge, OverdueBadge } from '../components/Badges';
import { AttachmentsSection } from '../components/AttachmentsSection';
import { useLiveQuery } from '../db/useLiveQuery';
import { getTaskFull } from '../db/repositories/taskFull';
import { addRemark, daysOverdue, daysPending, isOverdue, updateTask, softDeleteTask } from '../db/repositories/tasks';
import { unlinkContactFromTask } from '../db/repositories/contacts';
import { deleteTaskEmail, deleteTaskLink } from '../db/repositories/taskExtras';
import { callNumber, copyToClipboard, openEmail, openMaps, openWebLink, openWhatsApp, saveContactToDevice, shareTask } from '../lib/actions';
import { addEventToDeviceCalendar, addEventToDeviceCalendarWeb, openGoogleCalendarEvent } from '../lib/calendarIntegration';
import { colors, spacing, typography } from '../theme/theme';

/** react-native-web's `Alert.alert` is a no-op stub (confirmed: it renders
 * nothing and never invokes any button callback), so anything that needs to
 * actually notify the user on web — a real error, a delete confirmation —
 * needs a browser-native fallback. Native (iOS/Android) keeps using
 * `Alert.alert` exactly as before; this only adds the missing web path. */
function webAlert(message: string) {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert(message);
  }
}

export function TaskDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const taskId: string = route.params.taskId;
  const [remarkText, setRemarkText] = useState('');
  const [posting, setPosting] = useState(false);

  const { data: full, loading, reload } = useLiveQuery(
    ['tasks', 'task_remarks', 'task_activity', 'task_reassignments', 'task_contacts', 'contacts', 'task_emails', 'task_links', 'locations', 'meetings', 'calendar_events', 'travel_plans', 'attachments', 'reminders'],
    () => getTaskFull(taskId),
    [taskId]
  );

  if (loading && !full) return <Loading />;
  if (!full) {
    return (
      <View style={styles.notFound}>
        <Text style={typography.body}>This task could not be found — it may have been deleted.</Text>
      </View>
    );
  }

  const { task, remarks, activity, reassignments, contacts, emails, links, location, meeting, calendarEvent, travel, attachments } = full;
  const overdue = isOverdue(task);

  async function handlePostRemark() {
    if (!remarkText.trim()) {
      webAlert('Type a remark before adding.');
      return;
    }
    setPosting(true);
    try {
      await addRemark(taskId, remarkText);
      setRemarkText('');
    } catch (e) {
      // Previously any failure here was swallowed silently (no catch at
      // all), which is indistinguishable from the button doing nothing.
      webAlert(`Could not add remark: ${(e as Error)?.message ?? e}`);
    } finally {
      setPosting(false);
    }
  }

  async function handleComplete() {
    await updateTask(taskId, { status: task.status === 'completed' ? 'pending' : 'completed' });
  }

  function handleDelete() {
    const message = `Delete "${task.title}"? This can be recovered from sync history.`;
    if (Platform.OS === 'web') {
      // Alert.alert's [Cancel, Delete] button array is never rendered on web
      // (see webAlert above) — window.confirm is the standard browser
      // equivalent for a confirm/cancel choice.
      if (window.confirm(message)) {
        softDeleteTask(taskId)
          .then(() => navigation.goBack())
          .catch((e) => webAlert(`Could not delete task: ${(e as Error)?.message ?? e}`));
      }
      return;
    }
    Alert.alert('Delete task', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteTask(taskId);
          navigation.goBack();
        },
      },
    ]);
  }

  function buildCalendarEventData() {
    const start = meeting ? new Date(meeting.start_time) : task.due_date ? new Date(task.due_date) : new Date();
    const end = meeting?.end_time ? new Date(meeting.end_time) : new Date(start.getTime() + 30 * 60 * 1000);
    return {
      title: meeting?.title ?? task.title,
      startDate: start,
      endDate: end,
      location: meeting?.location ?? location?.label ?? undefined,
      notes: `From Task Manager: ${task.title}`,
    };
  }

  async function handleAddToCalendar() {
    if (Platform.OS === 'web') {
      // Primary web action: open a pre-filled Google Calendar "quick add" tab
      // — an actual calendar action, not just a file download. The .ics
      // download (handleDownloadIcs below) stays available as the fallback
      // for Outlook/Apple Calendar/etc. Native Android/iOS path below is
      // unchanged.
      openGoogleCalendarEvent(buildCalendarEventData());
      return;
    }
    const eventId = await addEventToDeviceCalendar(buildCalendarEventData());
    if (eventId) Alert.alert('Added to calendar', 'This event was added to your phone calendar.');
    else Alert.alert('Could not add to calendar', 'Please check calendar permissions in Settings.');
  }

  function handleDownloadIcs() {
    addEventToDeviceCalendarWeb(buildCalendarEventData());
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{task.title}</Text>
          <View style={styles.badgeRow}>
            <PriorityBadge priority={task.priority} />
            {overdue ? <OverdueBadge days={daysOverdue(task.due_date!)} /> : <StatusBadge status={task.status} />}
          </View>
          <View style={styles.metaGrid}>
            <MetaItem label="Category" value={task.category_name} />
            <MetaItem label="Assigned To" value={task.assigned_to_name ?? '—'} />
            <MetaItem label="Created On" value={format(new Date(task.created_at), 'dd-MMM-yyyy')} />
            <MetaItem label="Pending Since" value={`${format(new Date(task.pending_since), 'dd-MMM-yyyy')} (${daysPending(task.pending_since)}d)`} />
            {task.due_date && <MetaItem label="Due Date" value={format(new Date(task.due_date), 'dd-MMM-yyyy')} />}
          </View>
        </View>

        {/* Remarks / Timeline */}
        <SectionCard title="Remarks / Timeline" icon="chatbubble-ellipses-outline">
          <View style={styles.remarkInputRow}>
            <LabeledInput
              label=""
              value={remarkText}
              onChangeText={setRemarkText}
              placeholder="Add an update..."
              style={{ flex: 1 }}
              multiline
            />
          </View>
          <SecondaryButton label={posting ? 'Posting...' : 'Add Remark'} icon="send-outline" onPress={handlePostRemark} />
          {remarks.length === 0 ? (
            <Text style={styles.emptyText}>No remarks yet.</Text>
          ) : (
            remarks.map((r) => (
              <View key={r.id} style={styles.remarkItem}>
                <Text style={styles.remarkDate}>{format(new Date(r.created_at), 'dd-MMM, h:mm a')}</Text>
                <Text style={styles.remarkBody}>{r.body}</Text>
              </View>
            ))
          )}
        </SectionCard>

        {/* Contacts */}
        {contacts.length > 0 && (
          <SectionCard title="Contact" icon="person-outline">
            {contacts.map((c) => (
              <View key={c.id} style={styles.contactCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  {c.designation || c.company ? (
                    <Text style={styles.contactSub}>{[c.designation, c.company].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                  {c.mobile ? <Text style={styles.contactSub}>{c.mobile}</Text> : null}
                </View>
                <View style={styles.contactActions}>
                  {c.mobile && <Ionicons name="call-outline" size={20} color={colors.brand} onPress={() => callNumber(c.mobile!)} />}
                  {c.mobile && <Ionicons name="logo-whatsapp" size={20} color="#25D366" onPress={() => openWhatsApp(c.mobile!)} />}
                  {c.mobile && (
                    <Ionicons name="copy-outline" size={20} color={colors.textSecondary} onPress={() => copyToClipboard(c.mobile!, 'Number copied')} />
                  )}
                  <Ionicons
                    name="person-add-outline"
                    size={20}
                    color={colors.textSecondary}
                    onPress={() => saveContactToDevice(c.name, c.mobile, c.email, c.company)}
                  />
                  <Ionicons name="close-outline" size={20} color={colors.danger} onPress={() => unlinkContactFromTask(taskId, c.id)} />
                </View>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Emails */}
        {emails.length > 0 && (
          <SectionCard title="Email" icon="mail-outline">
            {emails.map((e) => (
              <View key={e.id} style={styles.rowWithDelete}>
                <IconTextRow icon="mail-outline" text={`${e.email_address}${e.subject ? ` — ${e.subject}` : ''}`} onPress={() => openEmail(e.email_address, e.subject ?? undefined, e.body ?? undefined)} />
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} onPress={() => deleteTaskEmail(e.id)} />
              </View>
            ))}
          </SectionCard>
        )}

        {/* Meeting */}
        {meeting && (
          <SectionCard title="Meeting" icon="time-outline">
            <Text style={styles.meetingTitle}>{meeting.title}</Text>
            <Text style={styles.contactSub}>{format(new Date(meeting.start_time), 'dd-MMM-yyyy, h:mm a')}</Text>
            {meeting.location ? <IconTextRow icon="location-outline" text={meeting.location} onPress={() => openMaps(meeting.location!)} /> : null}
            {meeting.meeting_link ? <IconTextRow icon="videocam-outline" text={meeting.meeting_link} onPress={() => openWebLink(meeting.meeting_link!)} /> : null}
          </SectionCard>
        )}

        {/* Calendar */}
        <SectionCard title="Calendar" icon="calendar-outline">
          {calendarEvent ? (
            <View>
              <Text style={styles.meetingTitle}>{calendarEvent.title}</Text>
              <Text style={styles.contactSub}>{format(new Date(calendarEvent.start_time), 'dd-MMM-yyyy, h:mm a')}</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>Not added to your device calendar yet.</Text>
          )}
          <SecondaryButton label="Add to Calendar" icon="calendar-outline" onPress={handleAddToCalendar} />
          {Platform.OS === 'web' && (
            <Pressable onPress={handleDownloadIcs} style={styles.icsFallbackLink}>
              <Text style={styles.icsFallbackText}>Or download .ics file (Outlook, Apple Calendar, etc.)</Text>
            </Pressable>
          )}
        </SectionCard>

        {/* Location */}
        {location && (location.label || location.maps_url) && (
          <SectionCard title="Location" icon="location-outline">
            <IconTextRow icon="navigate-outline" text={location.label || location.maps_url || ''} onPress={() => openMaps(location.maps_url || location.label || '')} />
          </SectionCard>
        )}

        {/* Attachments */}
        <AttachmentsSection taskId={taskId} attachments={attachments} />

        {/* Travel */}
        {travel && (
          <SectionCard title="Travel Details" icon="airplane-outline">
            <MetaItem label="City" value={travel.city} />
            <MetaItem label="Travel Date" value={format(new Date(travel.travel_date), 'dd-MMM-yyyy')} />
            {travel.return_date && <MetaItem label="Return Date" value={format(new Date(travel.return_date), 'dd-MMM-yyyy')} />}
            {travel.purpose && <MetaItem label="Purpose" value={travel.purpose} />}
            {travel.hotel_name && <MetaItem label="Hotel" value={travel.hotel_name} />}
            {travel.travel_booking_link && <IconTextRow icon="link-outline" text={travel.travel_booking_link} onPress={() => openWebLink(travel.travel_booking_link!)} />}
          </SectionCard>
        )}

        {/* Links */}
        {links.length > 0 && (
          <SectionCard title="Links" icon="link-outline">
            {links.map((l) => (
              <View key={l.id} style={styles.rowWithDelete}>
                <IconTextRow icon={l.link_type === 'website' ? 'globe-outline' : 'videocam-outline'} text={l.label || l.url} onPress={() => openWebLink(l.url)} />
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} onPress={() => deleteTaskLink(l.id)} />
              </View>
            ))}
          </SectionCard>
        )}

        {/* Reassignment History */}
        {reassignments.length > 0 && (
          <SectionCard title="Reassignment History" icon="swap-horizontal-outline">
            {reassignments.map((r) => (
              <View key={r.id} style={styles.remarkItem}>
                <Text style={styles.remarkDate}>{format(new Date(r.changed_at), 'dd-MMM-yyyy, h:mm a')}</Text>
                <Text style={styles.remarkBody}>
                  {r.from_name ? `${r.from_name} → ${r.to_name}` : `Assigned to ${r.to_name}`}
                  {r.reason ? `\nReason: ${r.reason}` : ''}
                  {r.remark ? `\nRemark: ${r.remark}` : ''}
                </Text>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Activity History */}
        {activity.length > 0 && (
          <SectionCard title="Activity History" icon="pulse-outline">
            {activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <Text style={styles.remarkDate}>
                  {format(new Date(a.created_at), 'dd-MMM, h:mm a')} — {a.actor_name ?? 'Unknown'}
                </Text>
                <Text style={styles.activityText}>{a.description}</Text>
              </View>
            ))}
          </SectionCard>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar: Edit | Reassign | Complete | Share */}
      <View style={styles.actionBar}>
        <BarButton icon="pencil-outline" label="Edit" onPress={() => navigation.navigate('EditTask', { taskId })} />
        <BarButton icon="swap-horizontal-outline" label="Reassign" onPress={() => navigation.navigate('Reassign', { taskId })} />
        <BarButton
          icon={task.status === 'completed' ? 'refresh-outline' : 'checkmark-circle-outline'}
          label={task.status === 'completed' ? 'Reopen' : 'Complete'}
          onPress={handleComplete}
          highlight={task.status !== 'completed'}
        />
        <BarButton icon="share-social-outline" label="Share" onPress={() => shareTask(task, task.category_name, remarks[0]?.body)} />
        <BarButton icon="trash-outline" label="Delete" onPress={handleDelete} danger />
      </View>
    </ScreenContainer>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function BarButton({ icon, label, onPress, danger, highlight }: { icon: any; label: string; onPress: () => void; danger?: boolean; highlight?: boolean }) {
  const color = danger ? colors.danger : highlight ? colors.success : colors.textSecondary;
  return (
    <Pressable style={styles.barButton} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.barButtonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  title: { ...typography.display, fontSize: 22, color: colors.textPrimary },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  metaItem: { minWidth: '42%' },
  metaLabel: { ...typography.tiny, color: colors.textMuted },
  metaValue: { ...typography.bodyMedium, color: colors.textPrimary },
  remarkInputRow: { marginBottom: spacing.xs },
  emptyText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', paddingVertical: spacing.sm },
  icsFallbackLink: { alignItems: 'center', paddingTop: spacing.xs },
  icsFallbackText: { ...typography.tiny, color: colors.brand },
  remarkItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
  remarkDate: { ...typography.tiny, color: colors.textMuted, marginBottom: 2 },
  remarkBody: { ...typography.body, color: colors.textPrimary },
  contactCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  contactName: { ...typography.bodyMedium, color: colors.textPrimary },
  contactSub: { ...typography.caption, color: colors.textSecondary },
  contactActions: { flexDirection: 'row', gap: spacing.md },
  rowWithDelete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meetingTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  activityRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs, alignItems: 'flex-start' },
  activityText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  barButton: { flex: 1, alignItems: 'center', gap: 2 },
  barButtonLabel: { ...typography.tiny },
});
