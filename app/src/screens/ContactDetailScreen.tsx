import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LabeledInput, PrimaryButton, SecondaryButton } from '../components/Common';
import { createContact, deleteContact, getContact, updateContact } from '../db/repositories/contacts';
import { callNumber, copyToClipboard, openEmail, openWhatsApp, saveContactToDevice } from '../lib/actions';
import { colors, spacing } from '../theme/theme';

export function ContactDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const contactId: string | undefined = route.params?.contactId;
  const isEdit = Boolean(contactId);

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [altMobile, setAltMobile] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contactId) return;
    getContact(contactId).then((c) => {
      if (!c) return;
      setName(c.name);
      setMobile(c.mobile ?? '');
      setAltMobile(c.alternate_mobile ?? '');
      setEmail(c.email ?? '');
      setCompany(c.company ?? '');
      setDesignation(c.designation ?? '');
      setRemarks(c.remarks ?? '');
    });
  }, [contactId]);

  async function handleSave() {
    if (!name.trim()) return Alert.alert('Name is required');
    setSaving(true);
    try {
      const input = { name, mobile: mobile || null, alternateMobile: altMobile || null, email: email || null, company: company || null, designation: designation || null, remarks: remarks || null };
      if (isEdit) await updateContact(contactId!, input);
      else await createContact(input);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert('Delete contact', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteContact(contactId!); navigation.goBack(); } },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <LabeledInput label="Name" required value={name} onChangeText={setName} />
      <LabeledInput label="Mobile Number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
      <LabeledInput label="Alternate Number" value={altMobile} onChangeText={setAltMobile} keyboardType="phone-pad" />
      <LabeledInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <LabeledInput label="Company" value={company} onChangeText={setCompany} />
      <LabeledInput label="Designation" value={designation} onChangeText={setDesignation} />
      <LabeledInput label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={3} style={{ minHeight: 70, textAlignVertical: 'top' }} />

      {isEdit && mobile ? (
        <View style={styles.quickRow}>
          <SecondaryButton label="Call" icon="call-outline" onPress={() => callNumber(mobile)} />
          <SecondaryButton label="WhatsApp" icon="logo-whatsapp" onPress={() => openWhatsApp(mobile)} color="#25D366" />
          <SecondaryButton label="Copy" icon="copy-outline" onPress={() => copyToClipboard(mobile, 'Number copied')} />
        </View>
      ) : null}
      {isEdit && email ? <SecondaryButton label="Send Email" icon="mail-outline" onPress={() => openEmail(email)} /> : null}
      <SecondaryButton label="Save to Phone Contacts" icon="person-add-outline" onPress={() => saveContactToDevice(name, mobile, email, company)} />

      <View style={{ height: spacing.lg }} />
      <PrimaryButton label={saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Contact'} onPress={handleSave} disabled={saving} icon="checkmark" />
      {isEdit && <SecondaryButton label="Delete Contact" icon="trash-outline" color={colors.danger} onPress={handleDelete} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  quickRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
});
