import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generateMnemonic, mnemonicToWords } from '../../../src/crypto/mnemonic';
import { useAppStore } from '../../../src/store/appStore';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

export default function SeedGenerate() {
  const { setPendingMnemonic } = useAppStore();
  const { fontSize, contentSize } = useScaledTheme();
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mnemonic = generateMnemonic(256); // 24 words (max security)
    setPendingMnemonic(mnemonic);
    setWords(mnemonicToWords(mnemonic));
    setLoading(false);
  }, []);

  function handleContinue() {
    router.push('/(auth)/onboarding/seed-backup');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Your Seed Phrase</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
          These 24 words are the master key to your wallet. Write them down in
          order and store them somewhere safe and offline.
        </Text>

        {/* Security warning */}
        <View style={styles.warning}>
          <Text style={[styles.warningText, { fontSize: contentSize.sm }]}>
            ⚠️ Never take a screenshot or store this phrase digitally.
            Anyone with these words has full access to your funds.
          </Text>
        </View>

        {/* Word grid */}
        <View style={styles.grid}>
          {words.map((word, i) => (
            <View key={i} style={styles.wordCard}>
              <Text style={[styles.wordNum, { fontSize: fontSize.xs }]}>{i + 1}</Text>
              <Text style={[styles.word, { fontSize: fontSize.sm }]}>{word}</Text>
            </View>
          ))}
        </View>

        <Button title="I've Written It Down — Continue" onPress={handleContinue} />

        <Button
          title="Cancel"
          variant="outline"
          onPress={() => {
            setPendingMnemonic(null);
            router.back();
          }}
        />

        <Text style={[styles.footerNote, { fontSize: contentSize.xs }]}>
          The next step will ask you to confirm these words.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
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
  warning: {
    backgroundColor: '#2A1A0A',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
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
  footerNote: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
});
