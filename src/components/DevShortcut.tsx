/**
 * DevShortcut — Rendered ONLY when __DEV__ is true.
 *
 * Shows a clearly-styled orange banner with a shortcut action button.
 * This component renders nothing in production builds.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants/theme';

interface DevShortcutProps {
  label: string;
  actionLabel: string;
  onAction: () => void;
}

export function DevShortcut({ label, actionLabel, onAction }: DevShortcutProps) {
  if (!__DEV__) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.devBadge}>🛠 DEV MODE</Text>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.8}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
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
    fontWeight: '700',
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
    fontWeight: '700',
  },
});
