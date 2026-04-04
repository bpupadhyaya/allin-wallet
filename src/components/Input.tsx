import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../constants/theme';
import { useScaledTheme } from '../hooks/useScaledTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  containerStyle,
  isPassword,
  style,
  ...rest
}: InputProps) {
  const { fontSize, scaleFont, uiScale } = useScaledTheme();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, { fontSize: fontSize.sm }]}>{label}</Text> : null}
      <View style={[styles.inputWrap, error ? styles.inputError : null, { height: 48 * uiScale }]}>
        <TextInput
          style={[styles.input, { fontSize: fontSize.md }, style]}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={styles.eye}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.eyeIcon, { fontSize: scaleFont(16) }]}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={[styles.errorText, { fontSize: fontSize.xs }]}>{error}</Text> : null}
      {hint && !error ? <Text style={[styles.hintText, { fontSize: fontSize.xs }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  inputError: { borderColor: COLORS.danger },
  input: {
    flex: 1,
    height: 48,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  eye: { padding: SPACING.sm },
  eyeIcon: { fontSize: 16 },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZE.xs },
  hintText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
});
