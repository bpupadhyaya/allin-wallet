/**
 * DevWalletBar — one-tap wallet creation + quick PIN login for testing.
 *
 * Uses 100% production code paths:
 *   - Creation: deriveWalletsFromMnemonic → saveCredentials → savePin → saveMnemonic
 *   - Login: verifyPin (real bcrypt) or authenticateWithBiometrics
 *   - Persistence: same secure store + AsyncStorage as production
 *
 * The ONLY non-production behavior: mock balances set after creation.
 *
 * ⚠️  REMOVE BEFORE PRODUCTION RELEASE  ⚠️
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
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
  getUsername,
  getWalletAddresses,
  verifyPin,
} from '../services/storage';
import { loadTxHistory } from '../services/txHistory';
import { isBiometricAvailable, authenticateWithBiometrics } from '../services/biometric';
import { useAppStore } from '../store/appStore';
import { COLORS, SPACING, BORDER_RADIUS, FONT_WEIGHT } from '../constants/theme';

export function DevWalletBar() {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [currentWalletId, setCurrentWalletId] = useState<string | null>(null);
  const { setAddresses, setHasWallet, setAuthenticated, setBalances, setRecentTxs } = useAppStore();

  // Detect which dev wallet is currently persisted
  useEffect(() => {
    getUsername().then((savedUser) => {
      if (savedUser) {
        const match = DEV_WALLETS.find((w) => w.username === savedUser);
        if (match) setCurrentWalletId(match.id);
      }
    });
  }, []);

  // ── Login to existing wallet (production flow + biometric/PIN) ──────────
  async function loginExisting(config: DevWalletConfig) {
    if (loading) return;
    setLoading(config.id);
    setStatus('Checking biometrics…');
    try {
      await new Promise((r) => setTimeout(r, 50));

      // Try biometric (same as production unlock)
      const bioAvailable = await isBiometricAvailable();
      if (bioAvailable) {
        setStatus('Tap fingerprint to unlock…');
        const ok = await authenticateWithBiometrics('Unlock AllIn Wallet');
        if (ok) {
          await loadAndNavigate(config.username);
          return;
        }
        // Biometric declined — fall through to PIN
      }

      // PIN verification (same bcrypt.compare as production)
      setStatus('Verifying PIN…');
      await new Promise((r) => setTimeout(r, 50));
      const pinOk = await verifyPin(config.pin);
      if (!pinOk) {
        throw new Error('PIN verification failed. The wallet may have been modified. Delete from Settings and re-create.');
      }
      await loadAndNavigate(config.username);
    } catch (e) {
      setLoading(null);
      setStatus('');
      Alert.alert('Login Failed', e instanceof Error ? e.message : String(e));
    }
  }

  // Same post-auth flow as production loginSuccess()
  async function loadAndNavigate(username: string) {
    const [addresses, history] = await Promise.all([
      getWalletAddresses(),
      loadTxHistory(),
    ]);
    if (addresses) setAddresses(addresses);
    setRecentTxs(history);
    setBalances(DEV_MOCK_BALANCES); // Only non-production line: seed mock balances
    setAuthenticated(true, username);
    setLoading(null);
    setStatus('');
    router.replace('/(wallet)/dashboard');
  }

  // ── Create new wallet (100% production code path) ─────────────────────
  async function createWallet(config: DevWalletConfig) {
    if (loading) return;
    setLoading(config.id);
    try {
      setStatus('Validating seed phrase…');
      await new Promise((r) => setTimeout(r, 50));
      if (!validateMnemonic(config.mnemonic)) {
        throw new Error(`Invalid mnemonic for ${config.id}`);
      }

      // Production: deriveWalletsFromMnemonic
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

      // Production: saveCredentials (bcrypt 12 rounds)
      setStatus('Encrypting password (bcrypt 12 rounds)…');
      await new Promise((r) => setTimeout(r, 50));
      await saveCredentials(config.username, config.password);

      // Production: savePin (bcrypt 10 rounds)
      setStatus('Encrypting PIN (bcrypt 10 rounds)…');
      await new Promise((r) => setTimeout(r, 50));
      await savePin(config.pin);

      // Production: save mnemonic + wallet type + addresses
      setStatus('Saving to secure storage…');
      await new Promise((r) => setTimeout(r, 50));
      await Promise.all([
        saveMnemonic(config.mnemonic),
        saveWalletType('seed'),
        saveWalletAddresses(addresses),
      ]);

      // Production: update store + navigate
      setAddresses(addresses);
      setHasWallet(true, 'seed');
      setBalances(DEV_MOCK_BALANCES); // Only non-production line
      setAuthenticated(true, config.username);
      setCurrentWalletId(config.id);

      setLoading(null);
      setStatus('');
      router.replace('/(wallet)/dashboard');
    } catch (e) {
      setLoading(null);
      setStatus('');
      Alert.alert(`${config.id} Failed`, e instanceof Error ? e.message : String(e));
    }
  }

  function handleTap(config: DevWalletConfig) {
    if (currentWalletId === config.id) {
      // Same wallet persisted — login via production auth
      loginExisting(config);
    } else if (currentWalletId) {
      // Different wallet — confirm switch
      Alert.alert(
        'Switch Wallet?',
        `Currently using ${currentWalletId}. Switch to ${config.id}? This replaces the current wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch', onPress: () => createWallet(config) },
        ],
      );
    } else {
      // No wallet — create
      createWallet(config);
    }
  }

  return (
    <>
      <Modal visible={loading !== null} transparent animationType="fade">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={modalStyles.walletId}>
              {currentWalletId === loading ? `Unlocking ${loading}…` : `Creating ${loading}…`}
            </Text>
            <Text style={modalStyles.status}>{status}</Text>
          </View>
        </View>
      </Modal>

      <View style={styles.container}>
        <Text style={styles.label}>Dev:</Text>
        <View style={styles.row}>
          {DEV_WALLETS.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.btn, currentWalletId === w.id && styles.btnCurrent]}
              onPress={() => handleTap(w)}
              activeOpacity={0.6}
              disabled={loading !== null}
            >
              <Text style={[styles.btnText, currentWalletId === w.id && styles.btnTextCurrent]}>
                {w.id}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );
}

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
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
    padding: SPACING.sm,
    gap: 4,
  },
  label: { color: COLORS.warning, fontSize: 10, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  btn: {
    backgroundColor: COLORS.warning + '18',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning + '55',
  },
  btnCurrent: { backgroundColor: COLORS.warning + '33', borderColor: COLORS.warning },
  btnText: { color: COLORS.warning, fontSize: 10, fontWeight: FONT_WEIGHT.bold },
  btnTextCurrent: { fontWeight: FONT_WEIGHT.heavy },
});
