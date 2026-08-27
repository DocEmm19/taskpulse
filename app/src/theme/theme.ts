// Central design tokens — the whole app's look lives here so it can be
// re-themed without touching screens. This is the "TaskPulse × CRED" dark
// system: matte near-black surfaces, layered charcoal cards with hairline
// borders, a restrained violet→indigo accent, and a big confident type scale.
// Every component reads these tokens, so the palette below re-skins the app.

export const colors = {
  bg: '#0B0B0F', // near-black, faint violet undertone (not flat #000)
  surface: '#16161C', // cards
  surfaceElevated: '#1F1F28', // raised elements (sheets, inputs, active tiles)
  border: '#2A2A33', // hairline
  textPrimary: '#F5F5F7',
  textSecondary: '#9A9AA6',
  textMuted: '#6B6B76',

  // Signature accent — a rich violet, used sparingly (primary actions, active
  // states, the priority "coin"). brandDark is the indigo end used for the
  // pseudo-gradient shading; brandSoft is a low-opacity tint for dark chips.
  brand: '#8B5CF6',
  brandDark: '#6366F1',
  brandSoft: 'rgba(139,92,246,0.16)',

  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.15)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.15)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.15)',

  // Priority accents — tuned for legibility on dark
  p1: '#FF6B6B',
  p1Soft: 'rgba(255,107,107,0.15)',
  p2: '#FBBF24',
  p2Soft: 'rgba(251,191,36,0.15)',
  p3: '#34D399',
  p3Soft: 'rgba(52,211,153,0.15)',

  // Category accents — brighter on dark so pills read clearly
  categoryPersonal: '#A78BFA',
  categoryOfficial: '#60A5FA',
  categoryTravel: '#34D399',
  categoryUrgent: '#FF6B6B',

  overlay: 'rgba(0,0,0,0.66)',
  white: '#FFFFFF',
  black: '#000000',
};

// Accent gradient stops (violet → indigo). expo-linear-gradient isn't a dep, so
// most surfaces use the solid `brand`; these are here for any place that can
// paint a gradient (e.g. web CSS) and to keep the two ends named in one spot.
export const accentGradient = ['#A78BFA', '#6366F1'];

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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

// Bigger, tighter, more confident than a stock scale — CRED's personality is
// largely in the type. fontFamily is filled in once Space Grotesk loads
// (see App.tsx / theme/fonts.ts); undefined falls back to the system sans.
export const fonts = {
  display: undefined as string | undefined, // set to 'SpaceGrotesk_700Bold' after load
  displayBold: undefined as string | undefined, // 'SpaceGrotesk_600SemiBold'
};

export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '600' as const, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  captionMedium: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.4 },
};

// On dark, shadows read faintly — depth comes mostly from the hairline border
// and a soft violet-tinted glow on accented elements. Keep a subtle card lift.
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  // Soft violet glow for the primary action / priority coin — the one place
  // the accent is allowed to bloom.
  glow: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
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
  on_hold: { label: 'On Hold', color: colors.textMuted, soft: 'rgba(255,255,255,0.06)' },
  cancelled: { label: 'Cancelled', color: colors.textMuted, soft: 'rgba(255,255,255,0.06)' },
  reassigned: { label: 'Reassigned', color: colors.categoryPersonal, soft: 'rgba(167,139,250,0.16)' },
};

// Per-field accents for the New Task screen — tuned to the dark palette.
export const fieldAccents = {
  title: { color: colors.brand, soft: colors.brandSoft },
  priority: { color: colors.warning, soft: colors.warningSoft },
  assignedTo: { color: colors.categoryPersonal, soft: 'rgba(167,139,250,0.16)' },
  company: { color: colors.success, soft: colors.successSoft },
  dueDate: { color: colors.categoryOfficial, soft: 'rgba(96,165,250,0.16)' },
  reminder: { color: '#2DD4BF', soft: 'rgba(45,212,191,0.16)' },
};

export const categoryIconFallback: Record<string, string> = {
  Personal: 'person-circle-outline',
  Official: 'briefcase-outline',
  Travel: 'airplane-outline',
  Urgent: 'alert-circle-outline',
  Network: 'people-outline',
};
