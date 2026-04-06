/**
 * DevShortcut — only shown in Metro dev builds (__DEV__ === true).
 * Completely stripped from production bundles.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../constants/theme';
import { useScaledTheme } from '../hooks/useScaledTheme';

interface DevShortcutProps {
  label: string;
  actionLabel: string;
  onAction: () => void;
}

export function DevShortcut({ label, actionLabel, onAction }: DevShortcutProps) {
  const { fontSize } = useScaledTheme();
  if (!__DEV__) return null;

  return (
    <View style={styles.banner}>
      <Text style={[styles.devBadge, { fontSize: fontSize.xs }]}>🛠 DEV MODE</Text>
      <Text style={[styles.label, { fontSize: fontSize.sm }]}>{label}</Text>
      <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.8}>
        <Text style={[styles.buttonText, { fontSize: fontSize.sm }]}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.devBg,
    borderWidth: 1,
    borderColor: COLORS.devIndicator,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  devBadge: {
    color: COLORS.devIndicator,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 1,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.devIndicator,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.heavy,
  },
});
