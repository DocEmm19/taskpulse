import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { persistLocalFile } from '../lib/localFiles';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Sharing from 'expo-sharing';
import { Attachment, AttachmentType } from '../types/models';
import { addAttachment, deleteAttachment, renameAttachment } from '../db/repositories/attachments';
import { canUseCamera, canRecordAudio, isWeb } from '../lib/platform';
import { startWebRecording, webRecordingSupported, WebRecordingHandle } from '../lib/webAudioRecorder';
import { newId } from '../lib/uuid';
import { PendingAttachment, pendingToAttachment } from '../lib/pendingAttachments';
import { colors, radius, spacing, typography } from '../theme/theme';
import { SectionCard } from './Common';

// Re-exported so existing imports (`from '../components/AttachmentsSection'`)
// keep working — the type/helper themselves live in lib/pendingAttachments.ts
// so they can be unit-tested without pulling in this file's native deps
// (expo-audio/expo-video/expo-image-picker, which fail to load under Jest).
export type { PendingAttachment };
export { pendingToAttachment };

interface Props {
  /** null = "pending" mode: no task exists yet, so picked files are held in
   * `pendingAttachments`/`onPendingAttachmentsChange` instead of being
   * written to the DB immediately. Existing callers (TaskDetailScreen)
   * always pass a real id and are unaffected. */
  taskId: string | null;
  attachments: Attachment[];
  pendingAttachments?: PendingAttachment[];
  onPendingAttachmentsChange?: (updater: (prev: PendingAttachment[]) => PendingAttachment[]) => void;
}

const ICONS: Record<AttachmentType, any> = { image: 'image-outline', pdf: 'document-text-outline', audio: 'mic-outline', video: 'videocam-outline' };

async function shareFile(att: Attachment) {
  if (!att.local_path) return;
  const available = await Sharing.isAvailableAsync();
  if (!available) return Alert.alert('Sharing not available on this device');
  await Sharing.shareAsync(att.local_path);
}

export function AttachmentsSection({ taskId, attachments, pendingAttachments, onPendingAttachmentsChange }: Props) {
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [activeAudioUri, setActiveAudioUri] = useState<string | null>(null);

  /** Writes straight to the DB when a task already exists (unchanged
   * behavior); otherwise stashes the file in local/parent state until the
   * task is created (New Task screen — see PendingAttachment above). */
  async function addOrQueueAttachment(data: {
    fileType: AttachmentType;
    fileName: string;
    localPath: string;
    fileSizeBytes?: number | null;
    mimeType?: string | null;
    durationSeconds?: number | null;
  }) {
    if (taskId) {
      await addAttachment({ taskId, ...data });
    } else {
      onPendingAttachmentsChange?.((prev) => [...prev, { localId: newId(), ...data }]);
    }
  }

  const pendingIds = new Set((pendingAttachments ?? []).map((p) => p.localId));

  const displayAttachments: Attachment[] = [
    ...(pendingAttachments ?? []).map((p) => pendingToAttachment(p, taskId)),
    ...attachments,
  ];

  // ---- Recording (expo-audio, hook-based) ----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 500);

  async function startRecording() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Microphone permission needed');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stopRecording() {
    const seconds = Math.round((recorderState.durationMillis ?? 0) / 1000);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return;
    const localPath = await persistLocalFile(uri, 'm4a');
    await addOrQueueAttachment({ fileType: 'audio', fileName: `voice_note_${Date.now()}.m4a`, localPath, durationSeconds: seconds, mimeType: 'audio/m4a' });
  }

  // ---- Recording (web, MediaRecorder-based) ----
  const [webRecording, setWebRecording] = useState<WebRecordingHandle | null>(null);
  const [isWebRecording, setIsWebRecording] = useState(false);

  async function startWebRecordingFlow() {
    try {
      const handle = await startWebRecording();
      setWebRecording(handle);
      setIsWebRecording(true);
    } catch (err) {
      Alert.alert('Microphone permission needed', err instanceof Error ? err.message : undefined);
    }
  }

  async function stopWebRecordingFlow() {
    if (!webRecording) return;
    setIsWebRecording(false);
    setWebRecording(null);
    try {
      const { uri, mimeType, fileName } = await webRecording.stop();
      const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const localPath = await persistLocalFile(uri, extension);
      await addOrQueueAttachment({ fileType: 'audio', fileName, localPath, mimeType });
    } catch (err) {
      Alert.alert('Recording failed', err instanceof Error ? err.message : undefined);
    }
  }

  // ---- Playback (expo-audio, hook-based: one shared player, swap source) ----
  const player = useAudioPlayer(activeAudioUri ?? undefined);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (activeAudioUri) player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAudioUri]);

  useEffect(() => {
    if (playerStatus.didJustFinish) setActiveAudioId(null);
  }, [playerStatus.didJustFinish]);

  function togglePlay(att: Attachment) {
    if (!att.local_path) return;
    if (activeAudioId === att.id) {
      if (playerStatus.playing) player.pause();
      else player.play();
      return;
    }
    setActiveAudioId(att.id);
    setActiveAudioUri(att.local_path);
  }

  // ---- Pickers ----
  async function pickImage(fromCamera: boolean) {
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed');
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true, mediaTypes: ['images'] });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const localPath = await persistLocalFile(asset.uri, 'jpg');
      await addOrQueueAttachment({ fileType: 'image', fileName: asset.fileName ?? `photo_${Date.now()}.jpg`, localPath, fileSizeBytes: asset.fileSize ?? null, mimeType: 'image/jpeg' });
    }
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const localPath = await persistLocalFile(asset.uri, 'pdf');
      await addOrQueueAttachment({ fileType: 'pdf', fileName: asset.name, localPath, fileSizeBytes: asset.size ?? null, mimeType: 'application/pdf' });
    }
  }

  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const localPath = await persistLocalFile(asset.uri, 'mp4');
    await addOrQueueAttachment({ fileType: 'video', fileName: asset.fileName ?? `video_${Date.now()}.mp4`, localPath, fileSizeBytes: asset.fileSize ?? null, durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : null, mimeType: 'video/mp4' });
  }

  async function recordVideo() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const localPath = await persistLocalFile(asset.uri, 'mp4');
    await addOrQueueAttachment({ fileType: 'video', fileName: `video_${Date.now()}.mp4`, localPath, durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : null, mimeType: 'video/mp4' });
  }

  function confirmDelete(att: Attachment) {
    const isPending = pendingIds.has(att.id);
    Alert.alert('Delete attachment', `Delete "${att.file_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (isPending) onPendingAttachmentsChange?.((prev) => prev.filter((p) => p.localId !== att.id));
          else deleteAttachment(att.id);
        },
      },
    ]);
  }

  function submitRename() {
    if (renamingId && renameText.trim()) {
      if (pendingIds.has(renamingId)) {
        const finalName = renameText.trim();
        onPendingAttachmentsChange?.((prev) => prev.map((p) => (p.localId === renamingId ? { ...p, fileName: finalName } : p)));
      } else {
        renameAttachment(renamingId, renameText.trim());
      }
    }
    setRenamingId(null);
  }

  const isRecording = recorderState.isRecording;
  const recordSeconds = Math.round((recorderState.durationMillis ?? 0) / 1000);

  return (
    <SectionCard title="Attachments" icon="attach-outline">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsRow}>
        {canUseCamera && <ActionButton icon="camera-outline" label="Photo" onPress={() => pickImage(true)} />}
        <ActionButton icon="images-outline" label="Gallery" onPress={() => pickImage(false)} />
        <ActionButton icon="document-attach-outline" label="PDF" onPress={pickPdf} />
        {canRecordAudio && (
          <ActionButton icon={isRecording ? 'stop-circle' : 'mic-outline'} label={isRecording ? `Stop (${recordSeconds}s)` : 'Record'} onPress={isRecording ? stopRecording : startRecording} danger={isRecording} />
        )}
        {isWeb && webRecordingSupported && (
          <ActionButton icon={isWebRecording ? 'stop-circle' : 'mic-outline'} label={isWebRecording ? 'Stop' : 'Record Audio'} onPress={isWebRecording ? stopWebRecordingFlow : startWebRecordingFlow} danger={isWebRecording} />
        )}
        {canUseCamera && <ActionButton icon="videocam-outline" label="Record Video" onPress={recordVideo} />}
        <ActionButton icon="film-outline" label="Video File" onPress={pickVideo} />
      </ScrollView>

      {(!canUseCamera || !canRecordAudio) && <Text style={styles.empty}>available in the phone app</Text>}

      {displayAttachments.length === 0 ? (
        <Text style={styles.empty}>No attachments yet. Add a photo, PDF, voice note, or video above.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {displayAttachments.map((att) => {
            const isPlayingThis = activeAudioId === att.id && playerStatus.playing;
            const isPending = pendingIds.has(att.id);
            return (
              <View key={att.id} style={styles.attachmentRow}>
                <Pressable
                  style={styles.attachmentMain}
                  onPress={() => {
                    if (att.file_type === 'image' || att.file_type === 'video') setPreview(att);
                    else if (att.file_type === 'audio') togglePlay(att);
                    else shareFile(att);
                  }}
                >
                  <Ionicons name={att.file_type === 'audio' && isPlayingThis ? 'pause-circle' : ICONS[att.file_type]} size={22} color={colors.brand} />
                  {renamingId === att.id ? (
                    <TextInput value={renameText} onChangeText={setRenameText} onSubmitEditing={submitRename} onBlur={submitRename} autoFocus style={styles.renameInput} />
                  ) : (
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attachmentName} numberOfLines={1}>{att.file_name}</Text>
                      <Text style={styles.attachmentMeta}>
                        {att.duration_seconds ? `${att.duration_seconds}s · ` : ''}
                        {isPending ? 'Will be added when you save' : att.sync_status === 'synced' ? 'Synced' : 'Stored on device'}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <View style={styles.attachmentActions}>
                  <Ionicons name="share-outline" size={18} color={colors.textSecondary} onPress={() => shareFile(att)} />
                  <Ionicons
                    name="pencil-outline"
                    size={18}
                    color={colors.textSecondary}
                    onPress={() => {
                      setRenamingId(att.id);
                      setRenameText(att.file_name);
                    }}
                  />
                  <Ionicons name="trash-outline" size={18} color={colors.danger} onPress={() => confirmDelete(att)} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPreview(null)}>
          {preview?.file_type === 'image' && preview.local_path && (
            <Image source={{ uri: preview.local_path }} style={styles.previewImage} resizeMode="contain" />
          )}
          {preview?.file_type === 'video' && preview.local_path && <VideoPreview uri={preview.local_path} />}
        </Pressable>
      </Modal>
    </SectionCard>
  );
}

/** Mounted only while the preview modal is open, so the video player hook
 * (expo-video) is created fresh for whichever attachment was tapped. */
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return <VideoView player={player} style={styles.previewVideo} nativeControls contentFit="contain" />;
}

function ActionButton({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.brand} />
      <Text style={[styles.actionLabel, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionsRow: { gap: spacing.sm, paddingBottom: spacing.md },
  actionButton: { alignItems: 'center', gap: 4, backgroundColor: colors.brandSoft, padding: spacing.sm, borderRadius: radius.md, width: 76 },
  actionLabel: { ...typography.tiny, color: colors.brand, textAlign: 'center' },
  empty: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', paddingVertical: spacing.sm },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  attachmentMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  attachmentName: { ...typography.body, color: colors.textPrimary },
  attachmentMeta: { ...typography.tiny, color: colors.textMuted },
  attachmentActions: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.sm },
  renameInput: { ...typography.body, color: colors.textPrimary, flex: 1, borderBottomWidth: 1, borderBottomColor: colors.brand },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '80%' },
  previewVideo: { width: '100%', height: '50%' },
});
