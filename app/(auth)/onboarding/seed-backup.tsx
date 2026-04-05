import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../src/store/appStore';
import { mnemonicToWords } from '../../../src/crypto/mnemonic';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

export default function SeedBackup() {
  const { pendingMnemonic } = useAppStore();
  const { fontSize, contentSize } = useScaledTheme();
  const [confirmed, setConfirmed] = useState(false);

  const words = pendingMnemonic ? mnemonicToWords(pendingMnemonic) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Back Up Your Seed Phrase</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
          Confirm you have written down all 24 words exactly as shown, in order.
        </Text>

        {/* Strong caution */}
        <View style={styles.cautionBox}>
          <Text style={[styles.cautionTitle, { fontSize: fontSize.sm }]}>🚨 Critical Security Warning</Text>
          <Text style={[styles.cautionText, { fontSize: contentSize.sm }]}>
            • If you lose your seed phrase, your funds are gone forever.{'\n'}
            • AllIn Wallet has zero ability to recover your wallet.{'\n'}
            • Write the words on paper — never store them digitally.{'\n'}
            • Keep the paper in a fireproof, waterproof location.{'\n'}
            • Never show your seed phrase to anyone, even AllIn support.
          </Text>
        </View>

        {/* Word list for final review */}
        <View style={styles.grid}>
          {words.map((word, i) => (
            <View key={i} style={styles.wordCard}>
              <Text style={[styles.wordNum, { fontSize: fontSize.xs }]}>{i + 1}</Text>
              <Text style={[styles.word, { fontSize: fontSize.sm }]}>{word}</Text>
            </View>
          ))}
        </View>

        {/* Acknowledgement checkbox */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setConfirmed((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            {confirmed ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={[styles.checkLabel, { fontSize: contentSize.sm }]}>
            I have written down all 24 words in the correct order and stored
            them in a safe, offline location.
          </Text>
        </TouchableOpacity>

        <Button
          title="Continue to Verification"
          onPress={() => router.push('/(auth)/onboarding/seed-verify')}
          disabled={!confirmed}
        />
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
  cautionBox: {
    backgroundColor: '#1A0A0A',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
    gap: SPACING.sm,
  },
  cautionTitle: {
    color: COLORS.danger,
    fontWeight: FONT_WEIGHT.heavy,
    fontSize: FONT_SIZE.sm,
  },
  cautionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  wordCard: {
    width: '23%',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordNum: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    width: 18,
    textAlign: 'right',
  },
  word: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    flex: 1,
  },
  checkRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkMark: { color: COLORS.text, fontSize: 14, fontWeight: FONT_WEIGHT.heavy },
  checkLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    flex: 1,
  },
});
