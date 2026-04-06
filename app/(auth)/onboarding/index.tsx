/**
 * Landing screen — shown to any user without an existing wallet.
 * Presents all wallet creation/import options in one place.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DevShortcut } from '../../../src/components/DevShortcut';
import { DevWalletBar } from '../../../src/components/DevWalletBar';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store/appStore';
import { DEV_MNEMONIC } from '../../../src/constants/config';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

interface OptionCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  variant?: 'default' | 'secondary' | 'outline';
  disabled?: boolean;
  badge?: string;
}

function OptionCard({
  icon,
  title,
  description,
  onPress,
  variant = 'default',
  disabled,
  badge,
}: OptionCardProps) {
  const { fontSize, contentSize, scaleFont } = useScaledTheme();
  return (
    <TouchableOpacity
      style={[
        styles.card,
        variant === 'secondary' && styles.cardSecondary,
        variant === 'outline' && styles.cardOutline,
        disabled && styles.cardDisabled,
      ]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.75}
    >
      <View style={styles.cardLeft}>
        <Text style={[styles.cardIcon, { fontSize: scaleFont(28) }]}>{icon}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, disabled && styles.cardTitleDisabled, { fontSize: fontSize.md }]}>
            {title}
          </Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={[styles.badgeText, { fontSize: scaleFont(9) }]}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardDesc, { fontSize: contentSize.xs }]}>{description}</Text>
      </View>
      {!disabled && <Text style={styles.cardChevron}>›</Text>}
    </TouchableOpacity>
  );
}

export default function OnboardingIndex() {
  const { setPendingMnemonic } = useAppStore();
  const { fontSize, contentSize, navSize, scaleFont } = useScaledTheme();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.logo, { fontSize: scaleFont(52) }]}>⬡</Text>
          <Text style={[styles.title, { fontSize: fontSize.xxxl }]}>AllIn Wallet</Text>
          <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
            100% non-custodial · Your keys, your coins
          </Text>
        </View>

        {/* Security notice */}
        <View style={styles.notice}>
          <Text style={[styles.noticeText, { fontSize: contentSize.xs }]}>
            🔐 AllIn never has access to your funds. No one can recover your
            wallet if you lose your seed phrase or credentials.
          </Text>
        </View>

        {/* Options */}
        <Text style={[styles.sectionLabel, { fontSize: navSize.xs }]}>Create or restore a wallet</Text>

        <OptionCard
          icon="📝"
          title="New Seed Phrase Wallet"
          description="Generate a new BIP-39 wallet. Works for BTC, ETH, and SOL. Compatible with MetaMask, Phantom, and any HD wallet."
          onPress={() => router.push('/(auth)/onboarding/seed-generate')}
        />

        <OptionCard
          icon="📱"
          title="Solana Seeker / Saga Key"
          description="Use the secure hardware key built into your Solana phone. SOL-chain only. Android required."
          onPress={() => router.push('/(auth)/onboarding/saga-connect')}
          variant="secondary"
          badge={Platform.OS !== 'android' ? 'Android only' : undefined}
        />

        <OptionCard
          icon="🔄"
          title="Import Existing Wallet"
          description="Already have a wallet? Enter your 12 or 24-word BIP-39 recovery phrase to restore BTC, ETH, and SOL."
          onPress={() => router.push('/(auth)/onboarding/import')}
          variant="outline"
        />

        {/* Existing wallet link */}
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={[styles.loginLinkText, { fontSize: fontSize.sm }]}>
            Already have an account?{' '}
            <Text style={styles.loginLinkAccent}>Sign in →</Text>
          </Text>
        </TouchableOpacity>

        {/* Dev shortcut — tap 1 of 3 */}
        <DevShortcut
          label="Skip seed phrase setup with dev mnemonic (tap 1 of 3)"
          actionLabel="Use Dev Seed Phrase"
          onAction={() => {
            setPendingMnemonic(DEV_MNEMONIC);
            router.push('/(auth)/onboarding/credentials');
          }}
        />

        {/* Dev quick wallets — ⚠️ REMOVE BEFORE PRODUCTION RELEASE */}
        <DevWalletBar />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },

  header: { alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.md },
  logo: { fontSize: 52, color: COLORS.primary },
  title: {
    fontSize: FONT_SIZE.xxxl,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: -1,
  },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textAlign: 'center' },

  notice: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  noticeText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },

  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: SPACING.sm,
  },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardSecondary: {
    borderColor: COLORS.secondary + '55',
  },
  cardOutline: {
    borderColor: COLORS.border,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardLeft: { flexShrink: 0 },
  cardIcon: { fontSize: 28 },
  cardBody: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  cardTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.heavy },
  cardTitleDisabled: { color: COLORS.textMuted },
  cardDesc: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 17 },
  cardChevron: { color: COLORS.textMuted, fontSize: 22, flexShrink: 0 },

  badge: {
    backgroundColor: COLORS.warning + '33',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: COLORS.warning, fontSize: 9, fontWeight: FONT_WEIGHT.heavy },

  loginLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  loginLinkText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  loginLinkAccent: { color: COLORS.primary, fontWeight: FONT_WEIGHT.heavy },
});
