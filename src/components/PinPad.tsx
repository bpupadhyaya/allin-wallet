import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants/theme';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

interface PinPadProps {
  onComplete: (pin: string) => void;
  length?: number;
  title?: string;
  subtitle?: string;
  error?: string;
  /** Clear the internal pin state (call with a key change) */
  resetKey?: string | number;
}

export function PinPad({
  onComplete,
  length = 6,
  title,
  subtitle,
  error,
}: PinPadProps) {
  const [pin, setPin] = useState('');

  const handlePress = (digit: string) => {
    if (digit === '') return;
    if (digit === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = pin + digit;
    setPin(next);
    if (next.length === length) {
      // Brief delay so the last dot fills visually before callback
      setTimeout(() => {
        setPin('');
        onComplete(next);
      }, 120);
    }
  };

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* PIN dots */}
      <View style={styles.dots}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length ? styles.dotFilled : null]}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Keypad */}
      <View style={styles.keypad}>
        {ROWS.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((d, di) => (
              <TouchableOpacity
                key={di}
                style={[styles.key, d === '' ? styles.keyHidden : null]}
                onPress={() => handlePress(d)}
                disabled={d === ''}
                activeOpacity={0.65}
              >
                <Text style={styles.keyText}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const KEY_SIZE = 72;

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: SPACING.lg },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  dots: { flexDirection: 'row', gap: SPACING.md },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  error: { color: COLORS.danger, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  keypad: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyHidden: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: '500',
  },
});
