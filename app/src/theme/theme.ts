// Central design tokens — the whole app's look lives here so it can be
// re-themed without touching screens. This is the "TaskPulse — Ink & Cobalt"
// system: a true, cool off-black base, cool charcoal surfaces with hairline
// borders, a single locked electric-cobalt accent, and semantic (not
// decorative) status colours. Every component reads these tokens, so the
// palette below re-skins the app.
//
// Design direction (executive / "operator" quiet-luxury), per the taste-skill +
// Impeccable anti-slop rules that drove this pass:
//   - ONE accent, locked app-wide (cobalt). The previous violet #8B7CF6 was the
//     textbook "AI purple glow" tell (Leon's LILA rule) — removed entirely.
//   - Cool grey family only (no warm/cool mixing). All neutrals share one hue.
//   - Priority/status hues are semantic and desaturated (<80% sat) so the cobalt
//     stays the only thing that "glows". Red/amber/green earn their place by
//     carrying meaning, not decoration.
//   - Shadows are tinted to the (cool) background, never pure black.

export const colors = {
  // True off-black, faintly cool — reads as "ink", not the flat #000 glare and
  // not the warm charcoal of the old theme. Depth comes from layering + the
  // hairline border, not from contrast.
  bg: '#0A0B0D', // ink — cool near-black
  surface: '#15171B', // cards — a soft cool step above bg
  surfaceElevated: '#1D2026', // raised elements (sheets, inputs, active tiles)
  border: '#262A31', // quiet cool hairline
  textPrimary: '#E8EAED', // cool off-white (not #FFF — reduces glare)
  textSecondary: '#9BA1AC', // cool grey
  textMuted: '#626873', // cool muted grey

  // Signature accent — a single electric cobalt, used sparingly (primary
  // actions, active states, the priority "coin", focus). brandDark is the
  // deeper end for shading; brandSoft is a low-opacity tint for dark chips.
  brand: '#3B82F6', // electric cobalt
  brandDark: '#2563EB',
  brandSoft: 'rgba(59,130,246,0.15)',

  // Semantic status colours — desaturated so they read as information, not
  // decoration, and never compete with the cobalt accent.
  success: '#3FB98C',
  successSoft: 'rgba(63,185,140,0.14)',
  warning: '#D8A24A',
  warningSoft: 'rgba(216,162,74,0.14)',
  danger: '#E5687A',
  dangerSoft: 'rgba(229,104,122,0.14)',

  // Priority accents — desaturated, cohesive on the cool ink base.
  p1: '#E5687A', // critical — cool-desaturated rose-red
  p1Soft: 'rgba(229,104,122,0.14)',
  p2: '#D8A24A', // important — muted amber
  p2Soft: 'rgba(216,162,74,0.14)',
  p3: '#3FB98C', // normal — muted emerald
  p3Soft: 'rgba(63,185,140,0.14)',

  // Category accents — muted, cool-leaning; legible dots/chips that don't fight
  // the cobalt. (Personal deliberately sits in the neutral-slate range so it
  // reads distinct from the brand cobalt.)
  categoryPersonal: '#8E9BB3', // cool slate
  categoryOfficial: '#5B8DEF', // blue (distinct from the brighter brand cobalt)
  categoryTravel: '#3FB98C', // teal-green
  categoryUrgent: '#E5687A', // rose

  overlay: 'rgba(6,7,9,0.72)', // cool-tinted scrim, not pure black
  white: '#FFFFFF',
  black: '#000000',
};

// Accent gradient stops (cobalt, tight range). expo-linear-gradient isn't a dep,
// so most surfaces use the solid `brand`; these are here for any place that can
// paint a gradient (e.g. web CSS) and to keep the two ends named in one spot.
export const accentGradient = ['#60A5FA', '#2563EB'];

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

// Tighter, more consistent radii than the old CRED scale — precision reads as
// "executive". One scale, applied consistently (Impeccable's shape-lock rule):
// controls/cards land at md–lg, pills stay fully round.
export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  pill: 999,
};

// Confident, tight type. display/h1/h2 carry the Space Grotesk fontFamily
// (loaded in App.tsx); if the font fails to load the app proceeds on the system
// sans. Numbers in data contexts should use tabular figures — see `tnum` below.
export const typography = {
  display: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 30, fontWeight: '800' as const, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.4 },
  h2: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 17, fontWeight: '600' as const, lineHeight: 23, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  captionMedium: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.4 },
};

// Tabular figures for data (counts, dates, stat tiles) — stops numbers jittering
// as they change and reads as precise/engineered. Spread onto any numeric Text.
export const tnum = { fontVariant: ['tabular-nums' as const] };

// On the cool ink base, shadows read faintly — depth comes mostly from the
// hairline border. Shadows are tinted cool (not pure black). The accent "glow"
// is kept restrained and cobalt, reserved for the one primary action (FAB).
export const shadow = {
  card: {
    shadowColor: '#05070A', // cool-tinted, not pure black
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 3,
  },
  floating: {
    shadowColor: '#05070A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
  },
  // Restrained cobalt glow for the primary action only — the one place the
  // accent is allowed to bloom, kept subtle so it stays executive, not gamer.
  glow: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
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
  on_hold: { label: 'On Hold', color: colors.textMuted, soft: 'rgba(255,255,255,0.06)' },
  cancelled: { label: 'Cancelled', color: colors.textMuted, soft: 'rgba(255,255,255,0.06)' },
  reassigned: { label: 'Reassigned', color: colors.categoryOfficial, soft: 'rgba(91,141,239,0.16)' },
};

// Per-field accents for the New Task screen. Locked to cobalt (Impeccable's
// one-accent rule) so field labels don't fluctuate hue-per-field — the previous
// green/teal/blue mix read as accent drift. Priority alone keeps a semantic
// amber, because that hue maps to the P2 selection the user actually sees.
export const fieldAccents = {
  title: { color: colors.brand, soft: colors.brandSoft },
  priority: { color: colors.warning, soft: colors.warningSoft },
  assignedTo: { color: colors.brand, soft: colors.brandSoft },
  company: { color: colors.brand, soft: colors.brandSoft },
  dueDate: { color: colors.brand, soft: colors.brandSoft },
  reminder: { color: colors.brand, soft: colors.brandSoft },
};

export const categoryIconFallback: Record<string, string> = {
  Personal: 'person-circle-outline',
  Official: 'briefcase-outline',
  Travel: 'airplane-outline',
  Urgent: 'alert-circle-outline',
  Network: 'people-outline',
};
