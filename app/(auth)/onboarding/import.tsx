/**
 * Import Existing Wallet
 * ----------------------
 * User enters their 12- or 24-word BIP-39 seed phrase to restore a wallet.
 * All 12 inputs are shown at once; each is validated on-the-fly.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { sanitizeMnemonic } from '../../../src/crypto/mnemonic';
import { useAppStore } from '../../../src/store/appStore';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

const WORD_COUNT = 12;

export default function ImportScreen() {
  const [words, setWords] = useState<string[]>(Array(WORD_COUNT).fill(''));
  const [errors, setErrors] = useState<boolean[]>(Array(WORD_COUNT).fill(false));
  const [showWarning, setShowWarning] = useState(true);
  const { fontSize, contentSize } = useScaledTheme();
  const inputRefs = useRef<Array<TextInput | null>>(Array(WORD_COUNT).fill(null));

  const setPendingMnemonic = useAppStore((s) => s.setPendingMnemonic);

  const updateWord = (index: number, value: string) => {
    // Strip any whitespace from individual input; handle paste of full phrase
    const trimmed = value.trim();

    // If user pastes a full phrase into the first box, distribute the words
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 12 && index === 0) {
      const filled = [...Array(WORD_COUNT).fill('')];
      parts.slice(0, WORD_COUNT).forEach((w, i) => {
        filled[i] = w.toLowerCase();
      });
      setWords(filled);
      setErrors(Array(WORD_COUNT).fill(false));
      inputRefs.current[WORD_COUNT - 1]?.focus();
      return;
    }

    const next = [...words];
    next[index] = trimmed.toLowerCase();
    setWords(next);

    const nextErrors = [...errors];
    nextErrors[index] = false;
    setErrors(nextErrors);
  };

  const handleSubmit = () => {
    const raw = words.join(' ');
    const phrase = sanitizeMnemonic(raw);
    if (!phrase) {
      const errs = words.map((w) => !w || w.length < 2);
      setErrors(errs);
      Alert.alert(
        'Invalid Seed Phrase',
        'One or more words are incorrect. Please double-check every word and its order.',
      );
      return;
    }
    setPendingMnemonic(phrase);
    router.push('/(auth)/onboarding/credentials');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { fontSize: fontSize.xl }]}>Import Wallet</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
          Enter your 12-word recovery phrase in the correct order.
        </Text>

        {/* Security warning */}
        {showWarning && (
          <View style={styles.warningBox}>
            <Text style={[styles.warningTitle, { fontSize: fontSize.sm }]}>⚠ Security Notice</Text>
            <Text style={[styles.warningText, { fontSize: contentSize.xs }]}>
              Never enter your seed phrase on an untrusted device or over a network
              connection. Your seed phrase grants full access to your funds. This
              app never transmits your phrase — it stays on-device only.
            </Text>
            <TouchableOpacity onPress={() => setShowWarning(false)}>
              <Text style={[styles.warningDismiss, { fontSize: fontSize.xs }]}>I understand — dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Word grid */}
        <View style={styles.grid}>
          {Array.from({ length: WORD_COUNT }).map((_, i) => (
            <View key={i} style={styles.wordRow}>
              <Text style={styles.wordIndex}>{i + 1}.</Text>
              <TextInput
                ref={(el) => { inputRefs.current[i] = el; }}
                style={[styles.wordInput, errors[i] && styles.wordInputError]}
                value={words[i]}
                onChangeText={(v) => updateWord(i, v)}
                onSubmitEditing={() => inputRefs.current[i + 1]?.focus()}
                placeholder={`word ${i + 1}`}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType={i < WORD_COUNT - 1 ? 'next' : 'done'}
                blurOnSubmit={i === WORD_COUNT - 1}
              />
            </View>
          ))}
        </View>

        <Button
          title="Import Wallet"
          onPress={handleSubmit}
          style={styles.btn}
        />

        <Button
          title="Cancel"
          variant="outline"
          onPress={() => router.back()}
          style={styles.btnSecondary}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.heavy,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: '#2A1A0A',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#F5A623',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  warningTitle: {
    color: '#F5A623',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.heavy,
  },
  warningText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  warningDismiss: {
    color: '#F5A623',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    textDecorationLine: 'underline',
  },
  grid: { gap: SPACING.sm },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  wordIndex: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    width: 24,
    textAlign: 'right',
  },
  wordInput: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  wordInputError: {
    borderColor: '#FF4D4D',
  },
  btn: { marginTop: SPACING.sm },
  btnSecondary: { marginTop: 0 },
});
