export const COLORS = {
  bg: '#0A0A0F',
  bgSecondary: '#12121A',
  bgCard: '#16162A',
  bgTertiary: '#1A1A2E',
  primary: '#6C63FF',
  primaryLight: '#9B94FF',
  secondary: '#00D4AA',
  danger: '#FF4444',
  warning: '#FFB800',
  success: '#00C851',
  text: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  border: '#2A2A3E',
  // Dev mode indicator – bright orange, clearly distinct
  devIndicator: '#FF6B35',
  devBg: '#2A1A0A',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ─── Font scaling system ────────────────────────────────────────────────────

/** Developer base scale (applied before user preferences) */
export const FONT_SCALE = 1.2;

/** Raw base sizes before any scaling */
export const BASE_FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
};

export type FontSizeKey = keyof typeof BASE_FONT_SIZES;

/** Static FONT_SIZE — used as fallback. Screens should prefer useScaledTheme(). */
export const FONT_SIZE = {
  xs:   Math.round(BASE_FONT_SIZES.xs * FONT_SCALE),
  sm:   Math.round(BASE_FONT_SIZES.sm * FONT_SCALE),
  md:   Math.round(BASE_FONT_SIZES.md * FONT_SCALE),
  lg:   Math.round(BASE_FONT_SIZES.lg * FONT_SCALE),
  xl:   Math.round(BASE_FONT_SIZES.xl * FONT_SCALE),
  xxl:  Math.round(BASE_FONT_SIZES.xxl * FONT_SCALE),
  xxxl: Math.round(BASE_FONT_SIZES.xxxl * FONT_SCALE),
};

// Centralized font weights — bump these to make everything bolder.
export const FONT_WEIGHT = {
  normal: '500' as const,
  medium: '600' as const,
  bold:   '700' as const,
  heavy:  '800' as const,
};

// ─── User display preferences ───────────────────────────────────────────────

export interface DisplayScales {
  /** Scales ALL text in the app (widest effect) */
  appFontScale: number;
  /** Extra scale for page body/description text */
  contentFontScale: number;
  /** Extra scale for navigation, tabs, section headers */
  navFontScale: number;
  /** Scales buttons, icons, cards, and other UI elements */
  uiElementScale: number;
}

export const DEFAULT_DISPLAY_SCALES: DisplayScales = {
  appFontScale: 1.0,
  contentFontScale: 1.0,
  navFontScale: 1.0,
  uiElementScale: 1.0,
};

export const SCALE_PRESETS = {
  small:      0.85,
  default:    1.0,
  large:      1.15,
  extraLarge: 1.35,
} as const;

export type ScalePresetKey = keyof typeof SCALE_PRESETS;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
