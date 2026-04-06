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
  PermissionsAndroid,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../src/store/appStore';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import bs58 from 'bs58';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

// Seed Vault derivation paths — must be valid Android URIs with scheme
// bip32:/m/... is the full BIP32 URI format the Seed Vault expects
const SOL_DERIVATION_PATHS = [
  "bip32:/m/44'/501'/0'",
  "bip44:/0'",
];

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
      // 0. Request runtime permission for Seed Vault access
      const granted = await PermissionsAndroid.request(
        'com.solanamobile.seedvault.ACCESS_SEED_VAULT' as any,
        {
          title: 'Seed Vault Access',
          message: 'AllIn Wallet needs access to your Seed Vault to use your hardware key.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Seed Vault permission denied. Please allow access to continue.');
      }

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
      const authTokenStr = String(authToken);
      let base58Address: string | null = null;
      const errors: string[] = [];

      // Helper to decode base64 (possibly URL-safe) public key to base58
      function decodeKeyToBase58(encoded: any): string | null {
        if (!encoded) return null;
        if (encoded instanceof Uint8Array) return bs58.encode(encoded);
        const s = String(encoded);
        const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
        return bs58.encode(Buffer.from(padded, 'base64'));
      }

      // All native calls need authToken as String (native .toLong() internally)
      const tokenStr = String(authToken);

      // Strategy 1: getAccounts — returns pre-derived keys, no path needed
      try {
        const accounts = await (SeedVault as any).getAccounts(tokenStr, null, null);
        if (accounts?.length > 0) {
          base58Address = decodeKeyToBase58(accounts[0].publicKeyEncoded);
        } else {
          errors.push('accounts: empty');
        }
      } catch (e: unknown) {
        errors.push(`accounts: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Strategy 2: getUserWallets
      if (!base58Address) {
        try {
          const wallets = await (SeedVault as any).getUserWallets(tokenStr);
          if (wallets?.length > 0) {
            base58Address = decodeKeyToBase58(wallets[0].publicKeyEncoded);
          } else {
            errors.push('wallets: empty');
          }
        } catch (e: unknown) {
          errors.push(`wallets: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Strategy 3: resolveDerivationPath then getPublicKey
      if (!base58Address) {
        for (const path of SOL_DERIVATION_PATHS) {
          try {
            const resolved = await (SeedVault as any).resolveDerivationPath(path);
            const keyResult = await (SeedVault as any).getPublicKey(tokenStr, resolved);
            base58Address = decodeKeyToBase58(keyResult?.publicKeyEncoded);
            if (base58Address) break;
          } catch (e: unknown) {
            errors.push(`resolve(${path}): ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // Strategy 4: getPublicKey with raw paths
      if (!base58Address) {
        for (const path of SOL_DERIVATION_PATHS) {
          try {
            const keyResult = await (SeedVault as any).getPublicKey(tokenStr, path);
            base58Address = decodeKeyToBase58(keyResult?.publicKeyEncoded);
            if (base58Address) break;
          } catch (e: unknown) {
            errors.push(`getPK(${path}): ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      if (!base58Address) {
        throw new Error(
          'Seed Vault auth OK but key derivation failed.\n' +
          errors.join('\n'),
        );
      }

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
