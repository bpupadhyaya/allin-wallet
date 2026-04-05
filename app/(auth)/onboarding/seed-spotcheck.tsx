/**
 * Seed Spot-Check — randomly picks 3 word positions and challenges the user.
 * Provides an extra layer of verification after the full re-entry.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../src/store/appStore';
import { mnemonicToWords } from '../../../src/crypto/mnemonic';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

const SPOT_COUNT = 5;

function pickRandomPositions(total: number, count: number): number[] {
  const positions = Array.from({ length: total }, (_, i) => i);
  // Fisher-Yates shuffle and take first `count`
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, count).sort((a, b) => a - b);
}

export default function SeedSpotCheck() {
  const { pendingMnemonic } = useAppStore();
  const correctWords = pendingMnemonic ? mnemonicToWords(pendingMnemonic) : [];
  const { fontSize, contentSize } = useScaledTheme();

  const [positions, setPositions] = useState<number[]>([]);
  const [inputs, setInputs] = useState<string[]>([]);
  const [errors, setErrors] = useState<boolean[]>([]);
  const [globalError, setGlobalError] = useState('');

  useEffect(() => {
    const pos = pickRandomPositions(correctWords.length, SPOT_COUNT);
    setPositions(pos);
    setInputs(Array(SPOT_COUNT).fill(''));
    setErrors(Array(SPOT_COUNT).fill(false));
  }, []);

  function updateInput(i: number, value: string) {
    const next = [...inputs];
    next[i] = value.trim().toLowerCase();
    setInputs(next);
    if (errors[i]) {
      const nextErr = [...errors];
      nextErr[i] = false;
      setErrors(nextErr);
    }
    setGlobalError('');
  }

  function handleCheck() {
    const newErrors = inputs.map(
      (word, i) => word !== correctWords[positions[i]],
    );
    const hasErrors = newErrors.some(Boolean);
    setErrors(newErrors);
    if (hasErrors) {
      setGlobalError('Some answers are incorrect. Check the highlighted fields.');
      return;
    }
    // All spot-checks passed → proceed to credentials setup
    router.push('/(auth)/onboarding/credentials');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Spot Check</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
          Almost there! Enter the words at the positions below to confirm your
          backup is accurate.
        </Text>

        <View style={styles.notice}>
          <Text style={[styles.noticeText, { fontSize: contentSize.sm }]}>
            ✅ Full phrase verification passed.{'\n'}
            Now confirm {SPOT_COUNT} randomly selected words from your 24-word phrase.
          </Text>
        </View>

        {globalError ? (
          <View style={styles.errorBanner}>
            <Text style={[styles.errorBannerText, { fontSize: contentSize.sm }]}>⚠️ {globalError}</Text>
          </View>
        ) : null}

        <View style={styles.challenges}>
          {positions.map((pos, i) => (
            <View key={i} style={styles.challengeRow}>
              <Text style={[styles.posLabel, { fontSize: fontSize.sm }]}>Word #{pos + 1}</Text>
              <TextInput
                style={[styles.challengeInput, errors[i] && styles.challengeInputError]}
                placeholder={`Enter word ${pos + 1}`}
                placeholderTextColor={COLORS.textMuted}
                value={inputs[i]}
                onChangeText={(t) => updateInput(i, t)}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
              {errors[i] ? (
                <Text style={[styles.fieldError, { fontSize: fontSize.xs }]}>Incorrect word</Text>
              ) : null}
            </View>
          ))}
        </View>

        <Button title="Confirm & Continue" onPress={handleCheck} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg },
  title: {
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.heavy,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  notice: {
    backgroundColor: '#0A1A12',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  noticeText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: '#1A0A0A',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  errorBannerText: { color: COLORS.danger, fontSize: FONT_SIZE.sm },
  challenges: { gap: SPACING.md },
  challengeRow: { gap: SPACING.xs },
  posLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  challengeInput: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  challengeInputError: { borderColor: COLORS.danger, backgroundColor: '#1A0A0A' },
  fieldError: { color: COLORS.danger, fontSize: FONT_SIZE.xs },
});
