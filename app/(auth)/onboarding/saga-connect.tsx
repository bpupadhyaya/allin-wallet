/**
 * Solana Seeker / Saga — connect via Seed Vault SDK.
 *
 * Uses the Seed Vault's non-extractable hardware key directly. Android-only.
 * After connecting, the user still sets up username/password/PIN.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../src/store/appStore';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

// Seed Vault uses BIP-44 URI scheme for derivation paths
const SOL_DERIVATION_PATH = "bip44:501'/0'/0'";

export default function SagaConnect() {
  const { setPendingSagaPubkey } = useAppStore();
  const { fontSize, contentSize } = useScaledTheme();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  async function handleConnect() {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Android Only',
        'Solana Seeker / Saga hardware key requires an Android device with the Seed Vault.',
      );
      return;
    }

    setConnecting(true);
    setError('');

    try {
      // Dynamic import — only available on Android
      const { SeedVault } = await import('@solana-mobile/seed-vault-lib');

      // 1. Check if Seed Vault is available on this device
      const available = await SeedVault.isSeedVaultAvailable(false);
      if (!available) {
        throw new Error('Seed Vault is not available on this device. This feature requires a Solana Seeker or Saga phone.');
      }

      // 2. Authorize access to a seed in the Seed Vault
      let authToken: number;

      try {
        // Try to get existing authorized seeds first
        const existingSeeds = await SeedVault.getAuthorizedSeeds();
        if (existingSeeds.length > 0) {
          authToken = existingSeeds[0].authToken;
        } else {
          throw new Error('no_authorized');
        }
      } catch {
        // No authorized seeds — request authorization (prompts biometric)
        try {
          const result = await SeedVault.authorizeNewSeed();
          authToken = result.authToken;
        } catch {
          // No seeds exist at all — create a new one
          const result = await SeedVault.createNewSeed();
          authToken = result.authToken;
        }
      }

      // 3. Get the SOL public key from the hardware
      const pubKeyResult = await SeedVault.getPublicKey(String(authToken), SOL_DERIVATION_PATH);
      const solAddress = pubKeyResult.publicKeyEncoded;

      if (!solAddress) {
        throw new Error('Failed to retrieve public key from Seed Vault.');
      }

      // 4. Convert base64-encoded public key to base58 for Solana address
      // The SDK returns base64, but we need base58 for Solana
      const bs58 = await import('bs58');
      const pubKeyBytes = Buffer.from(solAddress, 'base64');
      const base58Address = bs58.default.encode(pubKeyBytes);

      setAddress(base58Address);
      setPendingSagaPubkey(base58Address);
      setConnected(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      if (msg.includes('not available') || msg.includes('SeedVault')) {
        setError(msg);
      } else if (msg.includes('declined') || msg.includes('cancel') || msg.includes('denied')) {
        setError('Authorization cancelled. Tap "Connect" to try again.');
      } else {
        setError(msg || 'Connection failed. Make sure Seed Vault is set up and unlocked.');
      }
    } finally {
      setConnecting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Solana Seeker / Saga</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
          Use your phone's secure hardware key as your Solana wallet.
          Your private key never leaves the Seed Vault.
        </Text>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={[styles.infoTitle, { fontSize: fontSize.sm }]}>How it works</Text>
          <Text style={[styles.infoText, { fontSize: contentSize.sm }]}>
            {'• Your Seeker / Saga has a Secure Element (Seed Vault) with a non-extractable key.\n'}
            {'• AllIn connects directly to the Seed Vault hardware — your key never leaves the chip.\n'}
            {'• You will still create a username, password, and PIN for app-level security.\n'}
            {'• Only Solana (SOL, USDC, USDT) is available with this method — BTC/ETH require a seed phrase.'}
          </Text>
        </View>

        {/* iOS guard */}
        {Platform.OS !== 'android' && (
          <View style={styles.iosNotice}>
            <Text style={[styles.iosNoticeText, { fontSize: contentSize.sm }]}>
              Solana Seeker / Saga is Android-only.
              Use the Seed Phrase option on iOS.
            </Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, { fontSize: contentSize.sm }]}>{error}</Text>
          </View>
        ) : null}

        {/* Connecting spinner */}
        {connecting && (
          <View style={styles.spinnerRow}>
            <ActivityIndicator color={COLORS.secondary} size="small" />
            <Text style={[styles.spinnerText, { fontSize: contentSize.sm }]}>Waiting for Seed Vault…</Text>
          </View>
        )}

        {/* Success */}
        {connected && (
          <View style={styles.successBox}>
            <Text style={[styles.successTitle, { fontSize: fontSize.lg }]}>Connected!</Text>
            <Text style={[styles.addrLabel, { fontSize: fontSize.xs }]}>Solana Address:</Text>
            <Text style={styles.addr} numberOfLines={1} ellipsizeMode="middle">
              {address}
            </Text>
          </View>
        )}

        {/* Actions */}
        {!connected ? (
          <Button
            title={connecting ? 'Connecting…' : 'Connect Seed Vault'}
            onPress={handleConnect}
            loading={connecting}
            disabled={Platform.OS !== 'android' || connecting}
            variant="secondary"
          />
        ) : (
          <Button
            title="Continue to Account Setup"
            onPress={() => router.push('/(auth)/onboarding/credentials')}
          />
        )}

        <Button
          title="Back"
          variant="outline"
          onPress={() => router.back()}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },

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
  infoBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
    gap: SPACING.sm,
  },
  infoTitle: { color: COLORS.secondary, fontWeight: FONT_WEIGHT.heavy, fontSize: FONT_SIZE.sm },
  infoText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, lineHeight: 20 },

  iosNotice: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  iosNoticeText: { color: COLORS.warning, fontSize: FONT_SIZE.sm, lineHeight: 20 },

  errorBox: {
    backgroundColor: COLORS.danger + '22',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger + '66',
  },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZE.sm, lineHeight: 20 },

  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  spinnerText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },

  successBox: {
    backgroundColor: '#0A1A12',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.success,
    gap: SPACING.xs,
  },
  successTitle: { color: COLORS.success, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.heavy },
  addrLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  addr: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
  },
});
