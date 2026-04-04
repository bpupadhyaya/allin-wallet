import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  verifyPassword,
  verifyPin,
  getUsername,
  getWalletAddresses,
  saveWalletType,
  saveWalletAddresses,
} from '../../src/services/storage';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  getBiometricType,
  authenticateWithBiometrics,
} from '../../src/services/biometric';
import { loadTxHistory } from '../../src/services/txHistory';
import { useAppStore } from '../../src/store/appStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { PinPad } from '../../src/components/PinPad';
import { DevShortcut } from '../../src/components/DevShortcut';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  BORDER_RADIUS,
} from '../../src/constants/theme';
import { DEV_USERNAME, getDevAddresses } from '../../src/constants/config';

type Mode = 'password' | 'pin';

export default function LoginScreen() {
  const { setAuthenticated, setAddresses, setRecentTxs, setHasWallet } = useAppStore();
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');

  useEffect(() => {
    async function checkBiometric() {
      const available = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();
      if (available && enabled) {
        setBiometricAvailable(true);
        setBiometricLabel(await getBiometricType());
        // Auto-trigger biometric prompt on screen load
        handleBiometricLogin();
      }
    }
    checkBiometric();
  }, []);

  // ── Shared post-auth finalisation ─────────────────────────────────────────
  async function loginSuccess(user: string) {
    const [addresses, history] = await Promise.all([
      getWalletAddresses(),
      loadTxHistory(),
    ]);
    if (addresses) setAddresses(addresses);
    setRecentTxs(history);
    setAuthenticated(true, user);
    router.replace('/(wallet)/dashboard');
  }

  // ── Password ──────────────────────────────────────────────────────────────
  async function handlePasswordLogin() {
    if (!username.trim()) { setPwError('Please enter your username'); return; }
    if (!password) { setPwError('Please enter your password'); return; }
    setLoading(true);
    setPwError('');
    try {
      const storedUser = await getUsername();
      if (storedUser?.toLowerCase() !== username.trim().toLowerCase()) {
        setPwError('Invalid username or password');
        return;
      }
      const ok = await verifyPassword(password);
      if (!ok) { setPwError('Invalid username or password'); return; }
      await loginSuccess(storedUser);
    } catch {
      setPwError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── PIN ───────────────────────────────────────────────────────────────────
  async function handlePinComplete(pin: string) {
    setPinError('');
    try {
      const ok = await verifyPin(pin);
      if (!ok) { setPinError('Incorrect PIN. Try again.'); return; }
      const storedUser = await getUsername();
      await loginSuccess(storedUser ?? 'User');
    } catch {
      setPinError('PIN verification failed. Try your password.');
    }
  }

  // ── Biometric ─────────────────────────────────────────────────────────────
  async function handleBiometricLogin() {
    try {
      const ok = await authenticateWithBiometrics('Unlock AllIn Wallet');
      if (ok) {
        const storedUser = await getUsername();
        await loginSuccess(storedUser ?? 'User');
      }
    } catch {
      // Silently fail — user can fall back to password/PIN
    }
  }

  // ── Dev shortcut ──────────────────────────────────────────────────────────
  async function handleDevLogin() {
    setLoading(true);
    try {
      // Persist wallet type + addresses so bootstrap recognises the wallet
      // on app restart or after sign-out.
      await saveWalletType('seed');
      const devAddrs = getDevAddresses();
      await saveWalletAddresses(devAddrs);
      const history = await loadTxHistory();
      setAddresses(devAddrs);
      setHasWallet(true, 'seed');
      setRecentTxs(history);
      setAuthenticated(true, DEV_USERNAME);
      router.replace('/(wallet)/dashboard');
    } catch (e) {
      Alert.alert('Dev Login Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>AllIn Wallet</Text>
          <Text style={styles.tagline}>Your keys. Your coins.</Text>
        </View>

        {/* Biometric quick-unlock */}
        {biometricAvailable && (
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometricLogin}
            activeOpacity={0.7}
          >
            <Text style={styles.biometricIcon}>
              {biometricLabel === 'Face ID' ? '🔭' : '👆'}
            </Text>
            <Text style={styles.biometricText}>
              Unlock with {biometricLabel}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mode toggle */}
        <View style={styles.toggleRow}>
          {(['password', 'pin'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleActive]}
              onPress={() => {
                setMode(m);
                setPwError('');
                setPinError('');
              }}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'password' ? '🔑 Password' : '🔢 PIN'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'password' ? (
          <View style={styles.form}>
            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChangeText={setUsername}
              error={pwError}
            />
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(t) => { setPassword(t); setPwError(''); }}
              isPassword
              error={pwError ? ' ' : undefined}
              onSubmitEditing={handlePasswordLogin}
            />
            <Button
              title="Unlock Wallet"
              onPress={handlePasswordLogin}
              loading={loading}
            />
          </View>
        ) : (
          <PinPad
            title="Enter PIN"
            subtitle="Use your 6-digit PIN to unlock"
            onComplete={handlePinComplete}
            error={pinError}
          />
        )}

        {/* Non-custodial notice */}
        <View style={styles.caution}>
          <Text style={styles.cautionText}>
            🔒 AllIn Wallet is fully non-custodial. We never have access to
            your keys or funds. Your wallet auto-locks after{' '}
            {Math.round(15)} minutes of inactivity.{'\n'}Never share your seed
            phrase or PIN with anyone.
          </Text>
        </View>

        {/* Dev shortcut */}
        <DevShortcut
          label={`Dev login — skip all auth with pre-seeded wallet`}
          actionLabel="Dev Login (1 tap)"
          onAction={handleDevLogin}
        />

        {/* Create / restore wallet link */}
        <TouchableOpacity
          style={styles.createLink}
          onPress={() => router.replace('/(auth)/onboarding')}
        >
          <Text style={styles.createLinkText}>
            New here?{' '}
            <Text style={styles.createLinkAccent}>Create or import a wallet →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: {
    flexGrow: 1,
    padding: SPACING.lg,
    gap: SPACING.lg,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  logo: { width: 88, height: 88, borderRadius: 20 },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },

  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '66',
    paddingVertical: SPACING.md,
  },
  biometricIcon: { fontSize: 24 },
  biometricText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  toggleTextActive: { color: COLORS.text },
  form: { gap: SPACING.md },
  caution: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  cautionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  createLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  createLinkText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  createLinkAccent: { color: COLORS.primary, fontWeight: '700' },
});
