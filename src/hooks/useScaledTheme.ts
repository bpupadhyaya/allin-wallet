import { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { BASE_FONT_SIZES, FONT_SCALE, type FontSizeKey } from '../constants/theme';

type ScaledFontSizes = Record<FontSizeKey, number>;

function buildSizes(appScale: number, extraScale: number): ScaledFontSizes {
  const result = {} as ScaledFontSizes;
  for (const [key, base] of Object.entries(BASE_FONT_SIZES)) {
    result[key as FontSizeKey] = Math.round(base * FONT_SCALE * appScale * extraScale);
  }
  return result;
}

/**
 * Reactive font/UI scaling hook. Returns computed sizes based on user preferences.
 *
 * Usage:
 *   const { fontSize, contentSize, navSize, uiScale, scaleFont } = useScaledTheme();
 *   <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Title</Text>
 *   <Text style={[styles.body, { fontSize: contentSize.md }]}>Body text</Text>
 *   <View style={{ height: 56 * uiScale }}>...</View>
 */
export function useScaledTheme() {
  const appFontScale = useAppStore((s) => s.appFontScale);
  const contentFontScale = useAppStore((s) => s.contentFontScale);
  const navFontScale = useAppStore((s) => s.navFontScale);
  const uiElementScale = useAppStore((s) => s.uiElementScale);

  return useMemo(() => ({
    /** General font sizes (titles, labels, amounts) — affected by appFontScale only */
    fontSize: buildSizes(appFontScale, 1),
    /** Content/body text sizes — affected by appFontScale * contentFontScale */
    contentSize: buildSizes(appFontScale, contentFontScale),
    /** Navigation/header sizes — affected by appFontScale * navFontScale */
    navSize: buildSizes(appFontScale, navFontScale),
    /** Multiplier for UI elements (buttons, icons, cards) — appFontScale * uiElementScale */
    uiScale: appFontScale * uiElementScale,
    /** Scale any arbitrary number by the app font scale */
    scaleFont: (base: number) => Math.round(base * FONT_SCALE * appFontScale),
  }), [appFontScale, contentFontScale, navFontScale, uiElementScale]);
}
