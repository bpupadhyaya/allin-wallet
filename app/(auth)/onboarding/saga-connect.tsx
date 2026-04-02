/**
 * Solana Seeker / Saga — connect via Mobile Wallet Adapter.
 *
 * The Mobile Wallet Adapter (MWA) protocol lets dApps request signing
 * from the phone's secure hardware key without exposing the private key.
 * After connecting, the user still sets up username/password/PIN for
 * app-level security.
 *
 * Note: MWA is Android-only. iOS will show an info screen.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../src/store/appStore';
import { Button } from '../../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../../src/constants/theme';

export default function SagaConnect() {
  const { setPendingSagaPubkey } = useAppStore();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pubkey, setPubkey] = useState('');

  async function handleConnect() {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Android Only',
        'Solana Seeker / Saga hardware key is only available on Android. Please use seed phrase wallet on this device.',
      );
      return;
    }

    setConnecting(true);
    try {
      // Dynamic import to avoid crashing on iOS (package only installs on Android)
      // In production, install: @solana-mobile/mobile-wallet-adapter-protocol
      // and @solana-mobile/wallet-adapter-mobile
      const { transact } = await import(
        '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
      );

      await transact(async (wallet) => {
        const { accounts } = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: {
            name: 'AllIn Wallet',
            uri: 'https://allinwallet.app',
            icon: 'favicon.ico',
          },
        });

        if (accounts.length > 0) {
          const pk = Buffer.from(accounts[0].publicKey).toString('base64');
          setPubkey(accounts[0].address);
          setPendingSagaPubkey(accounts[0].address);
          setConnected(true);
        }
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Connection failed';
      Alert.alert('Connection Failed', `${msg}\n\nMake sure Seed Vault is unlocked on your Solana phone.`);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Connect Saga / Seeker</Text>
        <Text style={styles.subtitle}>
          Connect your Solana phone's secure hardware key to use it as your
          Solana wallet address.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ How it works</Text>
          <Text style={styles.infoText}>
            • Your Solana Seeker or Saga phone has a Secure Element (Seed Vault)
            that stores a non-extractable private key.{'\n'}
            • AllIn Wallet connects to it via the Mobile Wallet Adapter (MWA)
            standard — your private key never leaves the hardware.{'\n'}
            • You will still create a username, password, and PIN for
            additional app-level security.{'\n'}
            • BTC and ETH wallets are not available with the phone key; only
            the Solana address will be active.
          </Text>
        </View>

        {Platform.OS !== 'android' ? (
          <View style={styles.iosNotice}>
            <Text style={styles.iosNoticeText}>
              📱 Solana Seeker / Saga is Android-only.{'\n'}
              Please use the Seed Phrase option on iOS.
            </Text>
          </View>
        ) : null}

        {connected ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>✅ Connected!</Text>
            <Text style={styles.pubkeyLabel}>Solana Address:</Text>
            <Text style={styles.pubkey} numberOfLines={1} ellipsizeMode="middle">
              {pubkey}
            </Text>
          </View>
        ) : null}

        {!connected ? (
          <Button
            title={connecting ? 'Connecting...' : 'Connect Solana Phone Key'}
            onPress={handleConnect}
            loading={connecting}
            disabled={Platform.OS !== 'android'}
          />
        ) : (
          <Button
            title="Continue to Credentials Setup"
            onPress={() => router.push('/(auth)/onboarding/credentials')}
            variant="secondary"
          />
        )}

        <Button
          title="← Use Seed Phrase Instead"
          variant="outline"
          onPress={() => router.back()}
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
  infoBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    gap: SPACING.sm,
  },
  infoTitle: {
    color: COLORS.primaryLight,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  iosNotice: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  iosNoticeText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: '#0A1A12',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.success,
    gap: SPACING.sm,
  },
  successTitle: {
    color: COLORS.success,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  pubkeyLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  pubkey: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
  },
});
