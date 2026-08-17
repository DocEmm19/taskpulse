import { Alert, Linking, Platform, Share } from 'react-native';
// The default `expo-contacts` entry point's addContactAsync is deprecated and
// throws at runtime in this SDK — the working functional API (requestPermissionsAsync,
// addContactAsync, Fields, ContactTypes, Contact type) lives at 'expo-contacts/legacy'.
import * as Contacts from 'expo-contacts/legacy';
import * as Clipboard from 'expo-clipboard';
import { Task, TaskCategory } from '../types/models';
import { format } from 'date-fns';
import { logActivity } from '../db/helpers';

// Tap-to-action helpers used throughout task cards/detail (Req. #16, #17, #18, #19, #20, #35).

export async function callNumber(number: string) {
  // `telprompt:` is an iOS-only scheme (shows the native "Call?" confirmation).
  // Android and web both use the standard `tel:` URI — on web this hands off
  // to whatever the OS/browser has registered for phone calls (or does
  // nothing gracefully if nothing is registered), instead of showing the raw
  // unrecognized "telprompt:..." string.
  const url = Platform.OS === 'ios' ? `telprompt:${number}` : `tel:${number}`;
  const supported = await Linking.canOpenURL(url).catch(() => true);
  Linking.openURL(supported ? url : `tel:${number}`).catch(() => Alert.alert('Could not open dialer'));
}

export function openWhatsApp(number: string, message?: string) {
  const cleaned = number.replace(/[^\d+]/g, '');
  const url = `https://wa.me/${cleaned.replace('+', '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  Linking.openURL(url).catch(() => Alert.alert('WhatsApp not available', 'Could not open WhatsApp for this number.'));
}

export function openEmail(address: string, subject?: string, body?: string) {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  if (body) params.append('body', body);
  const query = params.toString();
  Linking.openURL(`mailto:${address}${query ? `?${query}` : ''}`).catch(() => Alert.alert('Could not open mail app'));
}

export function openWebLink(url: string) {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  Linking.openURL(normalized).catch(() => Alert.alert('Could not open link', normalized));
}

export function openMaps(query: string) {
  const url = /^https?:\/\//i.test(query) ? query : `https://maps.google.com/?q=${encodeURIComponent(query)}`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open Maps'));
}

export async function copyToClipboard(text: string, label = 'Copied') {
  await Clipboard.setStringAsync(text);
  // Alert.alert is a no-op stub on react-native-web (renders nothing) — the
  // copy itself already works fine on web via expo-clipboard's real
  // navigator.clipboard-backed implementation, it just had no visible
  // confirmation there. Native (iOS/Android) keeps using Alert.alert exactly
  // as before.
  if (Platform.OS === 'web') {
    window.alert(`${label}: ${text}`);
  } else {
    Alert.alert(label, text);
  }
}

/** expo-contacts has no way to WRITE a contact on web — its web shim always
 * returns permission "not granted" from requestPermissionsAsync (there's no
 * browser API for adding to a device's contacts app; the experimental
 * Contact Picker API is read-only and unrelated). The standard web-compatible
 * fallback — same pattern as the .ics calendar download — is a downloadable
 * .vcf (vCard) file, which any OS/phone contacts app can import in one step. */
function saveContactToDeviceWeb(name: string, phone?: string | null, email?: string | null, company?: string | null) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    company ? `ORG:${company}` : null,
    phone ? `TEL;TYPE=CELL:${phone}` : null,
    email ? `EMAIL:${email}` : null,
    'END:VCARD',
  ].filter((l): l is string => l !== null);

  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^\w-]+/g, '_').slice(0, 60) || 'contact'}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function saveContactToDevice(name: string, phone?: string | null, email?: string | null, company?: string | null) {
  if (Platform.OS === 'web') {
    saveContactToDeviceWeb(name, phone, email, company);
    return;
  }
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow contacts access to save this to your phone.');
    return;
  }
  const contact: Contacts.Contact = {
    contactType: Contacts.ContactTypes.Person,
    name,
    firstName: name,
    company: company ?? undefined,
    phoneNumbers: phone ? [{ label: 'mobile', number: phone }] : undefined,
    emails: email ? [{ label: 'work', email }] : undefined,
  };
  try {
    await Contacts.addContactAsync(contact);
    Alert.alert('Saved', `${name} added to your phone contacts.`);
  } catch (e) {
    Alert.alert('Could not save contact', String((e as Error).message ?? e));
  }
}

function fmt(d: string | null): string {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd-MMM-yyyy');
  } catch {
    return d;
  }
}

/** Builds the clean, formatted text used by the Share button (Req. #35 example). */
export function buildShareText(task: Task, categoryName: string): string {
  const lines = [
    task.title,
    `Priority: ${task.priority}`,
    `Status: ${task.status.replace('_', ' ')}`,
    task.assigned_to_name ? `Assigned To: ${task.assigned_to_name}` : null,
    `Category: ${categoryName}`,
    task.due_date ? `Due: ${fmt(task.due_date)}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

export async function shareTask(task: Task, categoryName: string, remark?: string) {
  const text = buildShareText(task, categoryName) + (remark ? `\nRemarks: ${remark}` : '');
  try {
    await Share.share({ message: text });
    await logActivity(task.id, 'shared', 'Task shared');
  } catch (e) {
    Alert.alert('Could not share', String((e as Error).message ?? e));
  }
}
