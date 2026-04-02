import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/Button';
import { DevShortcut } from '../../../src/components/DevShortcut';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store/appStore';
import { DEV_MNEMONIC } from '../../../src/constants/config';

export default function OnboardingIndex() {
  const { setPendingMnemonic } = useAppStore();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>⬡</Text>
          <Text style={styles.title}>Create Your Wallet</Text>
          <Text style={styles.subtitle}>
            AllIn Wallet is 100% non-custodial.{'\n'}
            Your keys never leave your device.
          </Text>
        </View>

        {/* Security notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>🔐 Before you begin</Text>
          <Text style={styles.noticeText}>
            • You are fully responsible for your funds.{'\n'}
            • No one — including AllIn — can recover your wallet if you lose
            your seed phrase or credentials.{'\n'}
            • Never share your seed phrase, password, or PIN with anyone.{'\n'}
            • Store your seed phrase offline in a safe location.
          </Text>
        </View>

        {/* Method cards */}
        <Text style={styles.sectionLabel}>Choose wallet type</Text>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>📝</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Seed Phrase Wallet</Text>
            <Text style={styles.cardDesc}>
              Standard BIP-39 wallet compatible with MetaMask, Phantom, and any
              HD wallet. Works on all devices. Gives you access to BTC, ETH,
              and SOL from one phrase.
            </Text>
          </View>
          <Button
            title="Create"
            onPress={() => router.push('/(auth)/onboarding/seed-generate')}
            style={styles.cardBtn}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>📱</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Solana Seeker / Saga Key</Text>
            <Text style={styles.cardDesc}>
              Use the secure hardware key built into your Solana phone. Provides
              SOL-chain access via the Mobile Wallet Adapter. You will still set
              a username, password, and PIN for app-level security.
            </Text>
          </View>
          <Button
            title="Connect"
            variant="secondary"
            onPress={() => router.push('/(auth)/onboarding/saga-connect')}
            style={styles.cardBtn}
          />
        </View>

        {/* Dev shortcut — pre-fill seed phrase and skip to credentials */}
        <DevShortcut
          label="Skip seed phrase setup with dev mnemonic (tap 1 of 3)"
          actionLabel="Use Dev Seed Phrase"
          onAction={() => {
            setPendingMnemonic(DEV_MNEMONIC);
            router.push('/(auth)/onboarding/credentials');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg },
  header: { alignItems: 'center', gap: SPACING.sm },
  logo: { fontSize: 48, color: COLORS.primary },
  title: {
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  notice: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    gap: SPACING.sm,
  },
  noticeTitle: {
    color: COLORS.warning,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  noticeText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  cardIcon: { fontSize: 32 },
  cardBody: { gap: SPACING.xs },
  cardTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  cardDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  cardBtn: { alignSelf: 'flex-start' },
});
