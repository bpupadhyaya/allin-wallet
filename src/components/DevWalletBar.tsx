/**
 * PracticeWalletBar — Production feature for test/practice wallets.
 *
 * Allows users to practice all wallet features (send, receive, swap, etc.)
 * using pre-configured test wallets with simulated balances before creating
 * their own real wallet. Also serves as a verification tool — users can
 * inspect every functionality of the app in a risk-free environment.
 *
 * Wallets are persistent, use real encryption, and follow the same code
 * paths as production wallets.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { DEV_WALLETS, DEV_MOCK_BALANCES, type DevWalletConfig } from '../constants/devWallets';
import { deriveWalletsFromMnemonic } from '../crypto/wallets';
import { validateMnemonic } from '../crypto/mnemonic';
import {
  saveCredentials,
  savePin,
  saveWalletType,
  saveWalletAddresses,
  saveMnemonic,
  getWalletAddresses,
} from '../services/storage';
import { loadTxHistory } from '../services/txHistory';
import {
  cacheDevWallet,
  loadCachedDevWallet,
  getCreatedDevWalletIds,
  restoreCachedWallet,
  trackLogin,
  trackSwitch,
  arePracticeWalletsHidden,
} from '../services/devWalletCache';
import * as SecureStore from 'expo-secure-store';
import { useAppStore } from '../store/appStore';
import { COLORS, SPACING, BORDER_RADIUS, FONT_WEIGHT, FONT_SIZE } from '../constants/theme';

export function DevWalletBar() {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { setAddresses, setHasWallet, setAuthenticated, setBalances, setRecentTxs } = useAppStore();

  useEffect(() => {
    getCreatedDevWalletIds().then(setCreatedIds);
    arePracticeWalletsHidden().then(setHidden);
    SecureStore.getItemAsync('wallet_username_v1').then((user) => {
      if (user) {
        const match = DEV_WALLETS.find((w) => w.username === user);
        if (match) setActiveId(match.id);
      }
    });
  }, []);

  if (hidden) return null;

  async function switchToWallet(config: DevWalletConfig) {
    const cached = await loadCachedDevWallet(config.id);
    if (cached) {
      setLoading(config.id);
      setStatus('Restoring practice wallet…');
      await new Promise((r) => setTimeout(r, 50));
      await restoreCachedWallet(cached);
      if (activeId && activeId !== config.id) {
        await trackSwitch(config.id);
      }
      await trackLogin(config.id);
      setStatus('Loading dashboard…');
      const [addresses, history] = await Promise.all([
        getWalletAddresses(),
        loadTxHistory(),
      ]);
      if (addresses) setAddresses(addresses);
      setRecentTxs(history);
      setHasWallet(true, 'seed');
      setBalances(DEV_MOCK_BALANCES);
      setAuthenticated(true, config.username);
      setActiveId(config.id);
      setLoading(null);
      setStatus('');
      router.replace('/(wallet)/dashboard');
    } else {
      await createWallet(config);
    }
  }

  async function createWallet(config: DevWalletConfig) {
    setLoading(config.id);
    try {
      setStatus('Validating seed phrase…');
      await new Promise((r) => setTimeout(r, 50));
      if (!validateMnemonic(config.mnemonic)) {
        throw new Error(`Invalid mnemonic for ${config.id}`);
      }

      setStatus('Deriving wallet addresses (8 chains)…');
      await new Promise((r) => setTimeout(r, 50));
      const derived = await deriveWalletsFromMnemonic(config.mnemonic);
      const addresses = {
        btc: derived.btc.address,
        eth: derived.eth.address,
        sol: derived.sol.address,
        ada: derived.ada.address,
        doge: derived.doge.address,
        xrp: derived.xrp.address,
        dot: derived.dot.address,
        pol: derived.pol.address,
      };

      setStatus('Encrypting password (bcrypt 12 rounds)…');
      await new Promise((r) => setTimeout(r, 50));
      await saveCredentials(config.username, config.password);

      setStatus('Encrypting PIN (bcrypt 10 rounds)…');
      await new Promise((r) => setTimeout(r, 50));
      await savePin(config.pin);

      setStatus('Saving to secure storage…');
      await new Promise((r) => setTimeout(r, 50));
      await Promise.all([
        saveMnemonic(config.mnemonic),
        saveWalletType('seed'),
        saveWalletAddresses(addresses),
      ]);

      const [pwHash, pinHash] = await Promise.all([
        SecureStore.getItemAsync('wallet_pw_hash_v1'),
        SecureStore.getItemAsync('wallet_pin_hash_v1'),
      ]);
      await cacheDevWallet({
        id: config.id,
        username: config.username,
        mnemonic: config.mnemonic,
        passwordHash: pwHash!,
        pinHash: pinHash!,
        walletType: 'seed',
        addresses,
      });
      await trackLogin(config.id);
      setCreatedIds((prev) => prev.includes(config.id) ? prev : [...prev, config.id]);

      setStatus('Loading dashboard…');
      setAddresses(addresses);
      setHasWallet(true, 'seed');
      setBalances(DEV_MOCK_BALANCES);
      setAuthenticated(true, config.username);
      setActiveId(config.id);

      setLoading(null);
      setStatus('');
      router.replace('/(wallet)/dashboard');
    } catch (e) {
      setLoading(null);
      setStatus('');
      Alert.alert(`${config.id} Failed`, e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      {/* Status modal */}
      <Modal visible={loading !== null} transparent animationType="fade">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={modalStyles.walletId}>
              {createdIds.includes(loading ?? '') ? `Switching to ${loading}…` : `Creating ${loading}…`}
            </Text>
            <Text style={modalStyles.status}>{status}</Text>
          </View>
        </View>
      </Modal>

      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.title}>Test / Practice Wallets</Text>
        <Text style={styles.subtitle}>
          Practice every feature risk-free before creating your real wallet.
          These use real encryption and the same code as production wallets — the only
          difference is simulated token balances.
        </Text>

        {/* Collapsible instructions */}
        <TouchableOpacity
          style={styles.instructionsToggle}
          onPress={() => setShowInstructions(!showInstructions)}
          activeOpacity={0.7}
        >
          <Text style={styles.instructionsToggleText}>
            {showInstructions ? '▾ Instructions' : '▸ Instructions'}
          </Text>
        </TouchableOpacity>

        {showInstructions && (
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionTitle}>What happens when you tap a wallet?</Text>
            <Text style={styles.instructionText}>
              {'• First tap creates the wallet using the same process as a real wallet — seed phrase derivation, password encryption (bcrypt 12 rounds), PIN encryption (bcrypt 10 rounds), and secure storage.\n'}
              {'• Subsequent taps restore the wallet instantly from a local cache.\n'}
              {'• You can switch between wallets freely — all are persistent across app restarts.'}
            </Text>

            <Text style={styles.instructionTitle}>Practice vs. Real Wallet — Comparison</Text>
            <View style={tbl.table}>
              {/* Header */}
              <View style={tbl.headerRow}>
                <Text style={[tbl.cell, tbl.headerCell, tbl.featureCol]}>Feature</Text>
                <Text style={[tbl.cell, tbl.headerCell, tbl.valCol]}>Practice</Text>
                <Text style={[tbl.cell, tbl.headerCell, tbl.valCol]}>Real</Text>
              </View>
              {[
                ['Seed phrase', 'Pre-set (public test vectors)', 'Your own (private, generated securely)'],
                ['Password encryption', 'bcrypt 12 rounds', 'bcrypt 12 rounds'],
                ['PIN encryption', 'bcrypt 10 rounds', 'bcrypt 10 rounds'],
                ['Secure storage', 'OS Keychain / Keystore', 'OS Keychain / Keystore'],
                ['Address derivation', 'BIP-44 / SLIP-10 (8 chains)', 'BIP-44 / SLIP-10 (8 chains)'],
                ['Token balances', 'Simulated ($1,000+ per token)', 'Real on-chain balances'],
                ['Transactions', 'UI flow works, no real broadcast', 'Real blockchain transactions'],
                ['Biometric unlock', 'Same (Face ID / Fingerprint)', 'Same (Face ID / Fingerprint)'],
                ['Session timeout', '15-min auto-lock', '15-min auto-lock'],
                ['Lockout policy', 'Exponential backoff', 'Exponential backoff'],
                ['WalletConnect', 'Same dApp signing flow', 'Same dApp signing flow'],
                ['Multi-wallet switching', 'Instant (cached hashes)', 'Single wallet only'],
                ['Funds at risk', 'None — no real value', 'Yes — real crypto assets'],
              ].map(([feature, practice, real], i) => (
                <View key={i} style={[tbl.row, i % 2 === 0 && tbl.rowAlt]}>
                  <Text style={[tbl.cell, tbl.featureCol, tbl.featureText]}>{feature}</Text>
                  <Text style={[tbl.cell, tbl.valCol, tbl.valText]}>{practice}</Text>
                  <Text style={[tbl.cell, tbl.valCol, tbl.valText]}>{real}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.instructionTitle}>How should you use them?</Text>
            <Text style={styles.instructionText}>
              {'• Try sending tokens between wallets to verify the send flow.\n'}
              {'• Practice swapping tokens (SOL ↔ USDC, ETH ↔ BTC, etc.).\n'}
              {'• Test receiving by copying addresses and verifying QR codes.\n'}
              {'• Lock the app and unlock with PIN, password, or biometrics.\n'}
              {'• Switch between wallets in Settings to verify multi-wallet workflows.\n'}
              {'• Explore every screen and feature to build confidence before using real funds.'}
            </Text>

            <Text style={styles.instructionTitle}>You are in charge</Text>
            <Text style={styles.instructionText}>
              AllIn Wallet is free and open source. Every line of code is available for
              inspection at github.com/bpupadhyaya/allin-wallet. These practice wallets
              let you verify every functionality without risk — no real funds, no real
              transactions on the blockchain. No support is provided since the app is
              free and open source, but you have every right to examine the code,
              report issues, and contribute improvements. Once you are confident,
              create your real wallet through the secure onboarding process.
            </Text>
          </View>
        )}

        {/* Wallet buttons */}
        <View style={styles.row}>
          {DEV_WALLETS.map((w) => {
            const isActive = activeId === w.id;
            const isCreated = createdIds.includes(w.id);
            return (
              <TouchableOpacity
                key={w.id}
                style={[
                  styles.btn,
                  isActive && styles.btnActive,
                  isCreated && !isActive && styles.btnCreated,
                ]}
                onPress={() => switchToWallet(w)}
                activeOpacity={0.6}
                disabled={loading !== null}
              >
                <Text style={[
                  styles.btnText,
                  isActive && styles.btnTextActive,
                  isCreated && !isActive && styles.btnTextCreated,
                ]}>
                  {w.id.toUpperCase()}
                </Text>
                {isCreated && (
                  <Text style={styles.btnSub}>{w.username}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {createdIds.length > 0 && (
          <Text style={styles.hint}>
            {activeId ? `Active: ${activeId.toUpperCase()}` : 'Tap to open'} · {createdIds.length} created
          </Text>
        )}
      </View>
    </>
  );
}

// Comparison table styles
const tbl = StyleSheet.create({
  table: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary + '22',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowAlt: {
    backgroundColor: COLORS.bg + '80',
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerCell: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 0.3,
  },
  featureCol: {
    flex: 2,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  featureText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
  },
  valCol: {
    flex: 3,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  valText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
    maxWidth: 320,
  },
  walletId: { color: COLORS.text, fontSize: 18, fontWeight: FONT_WEIGHT.heavy },
  status: { color: COLORS.primary, fontSize: 14, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.secondary + '44',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  title: {
    color: COLORS.secondary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.heavy,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  instructionsToggle: { paddingVertical: 2 },
  instructionsToggleText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  instructionsBox: {
    backgroundColor: COLORS.bg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  instructionTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    marginTop: 4,
  },
  instructionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  btn: {
    backgroundColor: COLORS.secondary + '15',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.secondary + '44',
    gap: 2,
  },
  btnActive: {
    backgroundColor: COLORS.secondary + '30',
    borderColor: COLORS.secondary,
  },
  btnCreated: {
    borderColor: COLORS.secondary + '77',
  },
  btnText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: FONT_WEIGHT.heavy,
    opacity: 0.6,
  },
  btnTextActive: { opacity: 1 },
  btnTextCreated: { opacity: 0.9 },
  btnSub: {
    color: COLORS.textMuted,
    fontSize: 8,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
});
