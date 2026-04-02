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
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../../src/constants/theme';

export default function SeedBackup() {
  const { pendingMnemonic } = useAppStore();
  const [confirmed, setConfirmed] = useState(false);

  const words = pendingMnemonic ? mnemonicToWords(pendingMnemonic) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Back Up Your Seed Phrase</Text>
        <Text style={styles.subtitle}>
          Confirm you have written down all 12 words exactly as shown, in order.
        </Text>

        {/* Strong caution */}
        <View style={styles.cautionBox}>
          <Text style={styles.cautionTitle}>🚨 Critical Security Warning</Text>
          <Text style={styles.cautionText}>
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
              <Text style={styles.wordNum}>{i + 1}</Text>
              <Text style={styles.word}>{word}</Text>
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
          <Text style={styles.checkLabel}>
            I have written down all 12 words in the correct order and stored
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
    fontWeight: '800',
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
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  cautionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  wordCard: {
    width: '30%',
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
    fontWeight: '600',
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
  checkMark: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  checkLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    flex: 1,
  },
});
