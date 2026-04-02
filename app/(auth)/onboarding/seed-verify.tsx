/**
 * Seed Verify — user must re-enter ALL 12 words in order.
 * This proves they have an accurate backup before the wallet is created.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../src/store/appStore';
import { mnemonicToWords } from '../../../src/crypto/mnemonic';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../../src/constants/theme';

const WORD_COUNT = 12;

export default function SeedVerify() {
  const { pendingMnemonic } = useAppStore();
  const [inputs, setInputs] = useState<string[]>(Array(WORD_COUNT).fill(''));
  const [errors, setErrors] = useState<boolean[]>(Array(WORD_COUNT).fill(false));
  const [globalError, setGlobalError] = useState('');

  const correctWords = pendingMnemonic ? mnemonicToWords(pendingMnemonic) : [];

  function updateWord(index: number, value: string) {
    const next = [...inputs];
    next[index] = value.trim().toLowerCase();
    setInputs(next);
    if (errors[index]) {
      const nextErr = [...errors];
      nextErr[index] = false;
      setErrors(nextErr);
    }
    setGlobalError('');
  }

  function handleVerify() {
    const newErrors = inputs.map(
      (word, i) => word !== correctWords[i],
    );
    const hasErrors = newErrors.some(Boolean);
    setErrors(newErrors);
    if (hasErrors) {
      const wrongCount = newErrors.filter(Boolean).length;
      setGlobalError(
        `${wrongCount} word${wrongCount > 1 ? 's are' : ' is'} incorrect. Words marked in red — please fix them.`,
      );
      return;
    }
    // All correct → proceed to spot check
    router.push('/(auth)/onboarding/seed-spotcheck');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Verify Seed Phrase</Text>
        <Text style={styles.subtitle}>
          Enter all 12 words in the correct order to confirm your backup.
        </Text>

        {globalError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {globalError}</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {Array.from({ length: WORD_COUNT }).map((_, i) => (
            <View key={i} style={[styles.inputCard, errors[i] && styles.inputCardError]}>
              <Text style={styles.inputNum}>{i + 1}</Text>
              <TextInput
                style={styles.wordInput}
                placeholder={`Word ${i + 1}`}
                placeholderTextColor={COLORS.textMuted}
                value={inputs[i]}
                onChangeText={(t) => updateWord(i, t)}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType={i < WORD_COUNT - 1 ? 'next' : 'done'}
              />
            </View>
          ))}
        </View>

        <Button title="Verify All Words" onPress={handleVerify} />
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
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: '#1A0A0A',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  errorBannerText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  inputCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    gap: 6,
  },
  inputCardError: { borderColor: COLORS.danger, backgroundColor: '#1A0A0A' },
  inputNum: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    width: 18,
    textAlign: 'right',
    flexShrink: 0,
  },
  wordInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    height: 36,
  },
});
