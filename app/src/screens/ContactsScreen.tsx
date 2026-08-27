import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, EmptyState, Loading } from '../components/Common';
import { useLiveQuery } from '../db/useLiveQuery';
import { listContacts } from '../db/repositories/contacts';
import { callNumber, copyToClipboard, openWhatsApp } from '../lib/actions';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

export function ContactsScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const { data: contacts, loading } = useLiveQuery('contacts', () => listContacts(search), [search]);

  return (
    <ScreenContainer>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search contacts..." placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        <Ionicons accessibilityRole="button" accessibilityLabel="Add contact" name="person-add-outline" size={22} color={colors.brand} onPress={() => navigation.navigate('ContactDetail', {})} />
      </View>

      <FlatList
        data={contacts ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>{[item.designation, item.company].filter(Boolean).join(' · ') || item.mobile || item.email || ''}</Text>
            </View>
            {item.mobile ? (
              <View style={styles.quickActions}>
                <Ionicons accessibilityRole="button" accessibilityLabel={`Call ${item.name}`} name="call-outline" size={20} color={colors.brand} onPress={() => callNumber(item.mobile!)} />
                <Ionicons accessibilityRole="button" accessibilityLabel={`WhatsApp ${item.name}`} name="logo-whatsapp" size={20} color="#25D366" onPress={() => openWhatsApp(item.mobile!)} />
                <Ionicons accessibilityRole="button" accessibilityLabel="Copy number" name="copy-outline" size={20} color={colors.textSecondary} onPress={() => copyToClipboard(item.mobile!, 'Number copied')} />
              </View>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={loading ? <Loading /> : <EmptyState icon="people-outline" title="No contacts yet" subtitle="Tap the + icon to add your first contact." />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary },
  listContent: { padding: spacing.lg, paddingBottom: 120 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h2, color: colors.brand },
  name: { ...typography.bodyMedium, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textMuted },
  quickActions: { flexDirection: 'row', gap: spacing.md },
});
