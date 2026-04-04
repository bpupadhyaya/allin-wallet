import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../constants/theme';
import { useScaledTheme } from '../hooks/useScaledTheme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'dev';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  textStyle,
}: ButtonProps) {
  const { fontSize, uiScale } = useScaledTheme();
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, { height: 52 * uiScale }, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? COLORS.primary : COLORS.text}
          size="small"
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text` as const], { fontSize: fontSize.md }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.secondary },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  danger: { backgroundColor: COLORS.danger },
  dev: { backgroundColor: COLORS.devIndicator },
  disabled: { opacity: 0.45 },
  text: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  primaryText: { color: COLORS.text },
  secondaryText: { color: '#000' },
  outlineText: { color: COLORS.textSecondary },
  dangerText: { color: COLORS.text },
  devText: { color: COLORS.text },
});
