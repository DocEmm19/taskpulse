// Central design tokens. Keep the whole app's look-and-feel defined in one place
// so it stays consistent and can be re-themed without touching every screen.

export const colors = {
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  border: '#E4E7EC',
  textPrimary: '#101828',
  textSecondary: '#475467',
  textMuted: '#98A2B3',

  brand: '#2452E8',
  brandDark: '#1936A8',
  brandSoft: '#EAF0FF',

  success: '#12B76A',
  successSoft: '#E7F8EF',
  warning: '#F79009',
  warningSoft: '#FFF6E9',
  danger: '#F04438',
  dangerSoft: '#FEECEB',

  // Priority accents
  p1: '#D92D20',
  p1Soft: '#FEECEB',
  p2: '#F79009',
  p2Soft: '#FFF6E9',
  p3: '#12879C',
  p3Soft: '#E6F6F9',

  // Category accents
  categoryPersonal: '#7A5AF8',
  categoryOfficial: '#2452E8',
  categoryTravel: '#12B76A',
  categoryUrgent: '#F04438',

  overlay: 'rgba(16, 24, 40, 0.5)',
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  display: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  h1: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  h2: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  captionMedium: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14 },
};

export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  floating: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
};

export type PriorityKey = 'P1' | 'P2' | 'P3';
export type StatusKey =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'cancelled'
  | 'reassigned';

export const priorityMeta: Record<PriorityKey, { label: string; color: string; soft: string }> = {
  P1: { label: 'P1 · Critical', color: colors.p1, soft: colors.p1Soft },
  P2: { label: 'P2 · Important', color: colors.p2, soft: colors.p2Soft },
  P3: { label: 'P3 · Normal', color: colors.p3, soft: colors.p3Soft },
};

export const statusMeta: Record<StatusKey, { label: string; color: string; soft: string }> = {
  pending: { label: 'Pending', color: colors.warning, soft: colors.warningSoft },
  in_progress: { label: 'In Progress', color: colors.brand, soft: colors.brandSoft },
  completed: { label: 'Completed', color: colors.success, soft: colors.successSoft },
  on_hold: { label: 'On Hold', color: colors.textMuted, soft: colors.border },
  cancelled: { label: 'Cancelled', color: colors.textMuted, soft: colors.border },
  reassigned: { label: 'Reassigned', color: colors.categoryPersonal, soft: '#F1EDFE' },
};

// Subtle per-field-group accents for the New Task screen's compact layout
// (New Task screen redesign). Purely additive — nothing above this reads or
// depends on these keys, so no existing screen's look changes.
export const fieldAccents = {
  title: { color: colors.brand, soft: colors.brandSoft },
  priority: { color: colors.warning, soft: colors.warningSoft },
  assignedTo: { color: '#7A5AF8', soft: '#F1EDFE' },
  company: { color: colors.success, soft: colors.successSoft },
  dueDate: { color: '#4F46E5', soft: '#EEF2FF' },
  reminder: { color: '#0D9488', soft: '#E6F6F5' },
  remarks: { color: colors.textSecondary, soft: colors.bg },
  attachments: { color: '#8B5CF6', soft: '#F5F0FF' },
};

export const categoryIconFallback: Record<string, string> = {
  Personal: 'person-circle-outline',
  Official: 'briefcase-outline',
  Travel: 'airplane-outline',
  Urgent: 'alert-circle-outline',
};
