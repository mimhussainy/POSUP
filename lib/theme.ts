/**
 * POSUP — Global Theme
 * -----------------------------------------------------------------------
 * Central source of truth for colors, borders, radii, font sizes, and
 * font weights used across the app. Change a value here and every screen
 * that imports it updates automatically.
 *
 * NOTE: fontFamily (appFont) is intentionally NOT included here.
 * Keep using `import { appFont } from './fonts'` separately — folding it
 * into this file or applying it globally breaks Ionicons rendering.
 *
 * CONSOLIDATION NOTES (read once, then ignore):
 * Several near-duplicate hex values existed across screens (tiny drift
 * from copy-pasting constants over time, not intentional design
 * differences). Each was collapsed to a single canonical value below.
 * Search this file for "CONSOLIDATED" to see exactly what was merged.
 * If any merge looks wrong for a specific screen, just override locally.
 * -----------------------------------------------------------------------
 */

import { Platform, StyleSheet } from 'react-native';

// ---------------------------------------------------------------------
// COLORS
// ---------------------------------------------------------------------

export const colors = {
  // Brand
  primary: '#8B38CB',
  primarySoft: '#F6EEFF',
  // CONSOLIDATED: PRIMARY_BORDER was #E9D5FF (history) / #E6D5FF (settings)
  primaryBorder: '#E9D5FF',
  // New: focus-state ring color from the login screen inputs
  borderFocus: '#B982EA',

  // Backgrounds
  // CONSOLIDATED: APP_BG was #F5F5F5 (order/history/settings) /
  // #F7F8FB (root layout) / #F6F7F9 (login) — 3 near-identical variants
  appBg: '#F5F5F5',
  cardBg: '#FFFFFF',
  // Login screen's slightly-tinted input background
  fieldBg: '#F8F9FB',

  // Borders
  // CONSOLIDATED: BORDER was #D8DCE5 (order, native) / #F1F3F8 (order, web)
  // / #ECEEF3 (history, settings) — kept as two tokens: a soft default
  // and a slightly stronger one for inputs/cards on native.
  border: '#ECEEF3',
  // Native gets a darker value for better visibility with the hairline
  // width; web keeps the original lighter value since its 1px width
  // already reads clearly at the original shade.
  borderStrong: Platform.OS === 'web' ? '#D8DCE5' : '#C4CAD6',
  fieldBorder: '#CDD3DE',

  // Text
  // CONSOLIDATED: TEXT was #151521 / #111827 / #171725 / #1D1D1F
  text: '#151521',
  // CONSOLIDATED: MUTED was #7B7F8C / #6B7280 / #7A7F8C / #6F7682
  muted: '#7B7F8C',
  softText: '#4B5563',
  placeholder: '#9DA4AF',

  // Semantic
  success: '#16A34A',
  successSoft: '#EAFBF1',
  successLight: '#4ADE80',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  info: '#2563EB',
  infoSoft: '#EEF4FF',
  // CONSOLIDATED: ORANGE/warning was #F97316 (history) / #F59E0B (settings)
  warning: '#F59E0B',
  warningSoft: '#FFF1E8',

  // Dark order-panel palette (from the New Order screen)
  dark: '#17172A',
  darkCard: '#24243E',
  darkCard2: '#2B2B49',
  darkBorder: '#33334F',

  white: '#FFFFFF',
} as const;

// Category badge hashing palette (separate concept from theme colors —
// used only by getCatColor() to assign a consistent color per category name)
export const catPalette = [
  '#FF6B6B', '#F97316', '#FACC15', '#22C55E', '#14B8A6',
  '#38BDF8', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B',
  '#84CC16', '#64748B', '#A855F7', '#FB7185', '#2DD4BF',
];

// ---------------------------------------------------------------------
// BORDERS
// ---------------------------------------------------------------------

export const borders = {
  hairline: StyleSheet.hairlineWidth,
  // Web gets a flat 1px line; native keeps the OS-native hairline
  // (sub-pixel width) for a crisper, platform-appropriate look.
  thin: Platform.OS === 'web' ? 1 : StyleSheet.hairlineWidth,
  medium: 2,
};

// ---------------------------------------------------------------------
// RADII
// ---------------------------------------------------------------------

export const radii = {
  xs: 4,
  sm: 8,
  smd: 10,
  md: 12,
  mdl: 13,
  lg: 14,
  lgl: 15,
  xl: 16,
  xxl: 18,
  xxxl: 20,
  huge: 22,
  massive: 24,
  giant: 28,
  giant2: 30,
  full: 999,
};

// ---------------------------------------------------------------------
// FONT SIZES
// ---------------------------------------------------------------------

export const fontSizes = {
  xs: 10,
  sm: 11,
  smd: 12,
  md: 13,
  mdl: 14,
  lg: 15,
  lgl: 16,
  xl: 17,
  xxl: 18,
  xxxl: 20,
  huge: 21,
  massive: 22,
  giant: 25,
};

// ---------------------------------------------------------------------
// FONT WEIGHTS
// ---------------------------------------------------------------------

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  // Inter's 700/800/900 cuts render visually heavier on web than the
  // native OS system font does at the same nominal weight — so each
  // is capped down on web only. Native (iOS/Android) is unaffected
  // since Platform.OS !== 'web' there.
  bold: (Platform.OS === 'web' ? '500' : '700') as '500' | '700',
  extrabold: (Platform.OS === 'web' ? '600' : '800') as '600' | '800',
  black: (Platform.OS === 'web' ? '700' : '900') as '700' | '900',
};

// ---------------------------------------------------------------------
// SPACING (not yet used consistently across screens, but available)
// ---------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// ---------------------------------------------------------------------
// Helper used by CategoryButton to assign a stable color per category
// ---------------------------------------------------------------------

export function getCatColor(name: string): string {
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return catPalette[Math.abs(hash) % catPalette.length];
}