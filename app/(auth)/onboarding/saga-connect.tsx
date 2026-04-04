/**
 * Solana Seeker / Saga — connect via Mobile Wallet Adapter v2.
 *
 * Uses the Seed Vault's non-extractable hardware key. Android-only.
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
        'Solana Seeker / Saga hardware key requires an Android device with the Seed Vault app installed.',
      );
      return;
    }

    setConnecting(true);
    setError('');

    try {
      // Dynamic import keeps the bundle valid on iOS where the package is absent
      const { transact } = await import(
        '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
      ) as { transact: Function };

      const result = await transact(async (wallet: any) => {
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: {
            name: 'AllIn Wallet',
            uri: 'https://allinwallet.app',
            icon: 'favicon.ico',
          },
        });
        return authResult;
      });

      // MWA v1 and v2 both expose accounts[0].address (base58 string)
      const accounts = result?.accounts ?? result?.selectedAccount ? [result.selectedAccount] : [];
      const account = accounts[0];

      if (!account?.address) {
        throw new Error('No account returned from Seed Vault. Make sure Seed Vault is set up on your Seeker.');
      }

      setAddress(account.address);
      setPendingSagaPubkey(account.address);
      setConnected(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      if (msg.includes('No WalletActivity') || msg.includes('no wallet')) {
        setError('Seed Vault app not found. Please install the Seed Vault app from the Solana Saga / Seeker app store.');
      } else if (msg.includes('USER_DECLINED') || msg.includes('declined') || msg.includes('cancel')) {
        setError('Authorization cancelled. Tap "Connect" to try again.');
      } else {
        setError(msg || 'Connection failed. Make sure Seed Vault is unlocked.');
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
          <Text style={[styles.infoTitle, { fontSize: fontSize.sm }]}>ℹ️ How it works</Text>
          <Text style={[styles.infoText, { fontSize: contentSize.sm }]}>
            {'• Your Seeker / Saga has a Secure Element (Seed Vault) with a non-extractable key.\n'}
            {'• AllIn connects via the Mobile Wallet Adapter — your key stays in hardware.\n'}
            {'• You will still create a username, password, and PIN for app-level security.\n'}
            {'• Only Solana (SOL, USDC, USDT) is available with this method — BTC/ETH require a seed phrase.'}
          </Text>
        </View>

        {/* iOS guard */}
        {Platform.OS !== 'android' && (
          <View style={styles.iosNotice}>
            <Text style={[styles.iosNoticeText, { fontSize: contentSize.sm }]}>
              📱 Solana Seeker / Saga is Android-only.
              Use the Seed Phrase option on iOS.
            </Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, { fontSize: contentSize.sm }]}>⚠ {error}</Text>
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
            <Text style={[styles.successTitle, { fontSize: fontSize.lg }]}>✅ Connected!</Text>
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
            title="Continue to Account Setup →"
            onPress={() => router.push('/(auth)/onboarding/credentials')}
          />
        )}

        <Button
          title="← Back"
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
