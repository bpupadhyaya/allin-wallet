import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  verifyPassword,
  verifyPin,
  getUsername,
  getWalletAddresses,
  getWalletType,
  hasPin,
} from '../../src/services/storage';
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
import {
  DEV_PASSWORD,
  DEV_PIN,
  DEV_USERNAME,
} from '../../src/constants/config';

type Mode = 'password' | 'pin';

export default function LoginScreen() {
  const { setAuthenticated, setAddresses } = useAppStore();
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Password login ────────────────────────────────────────────────────────
  async function handlePasswordLogin() {
    if (!username.trim()) {
      setPwError('Please enter your username');
      return;
    }
    if (!password) {
      setPwError('Please enter your password');
      return;
    }
    setLoading(true);
    setPwError('');
    try {
      const storedUser = await getUsername();
      if (storedUser?.toLowerCase() !== username.trim().toLowerCase()) {
        setPwError('Invalid username or password');
        return;
      }
      const ok = await verifyPassword(password);
      if (!ok) {
        setPwError('Invalid username or password');
        return;
      }
      await loginSuccess(storedUser);
    } catch {
      setPwError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── PIN login ─────────────────────────────────────────────────────────────
  async function handlePinComplete(pin: string) {
    setPinError('');
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        setPinError('Incorrect PIN. Please try again.');
        return;
      }
      const storedUser = await getUsername();
      await loginSuccess(storedUser ?? 'User');
    } catch {
      setPinError('PIN verification failed. Try password instead.');
    }
  }

  async function loginSuccess(username: string) {
    const addresses = await getWalletAddresses();
    if (addresses) setAddresses(addresses);
    setAuthenticated(true, username);
    router.replace('/(wallet)/dashboard');
  }

  // ── Dev shortcut ──────────────────────────────────────────────────────────
  async function handleDevLogin() {
    setLoading(true);
    try {
      const addresses = await getWalletAddresses();
      if (addresses) setAddresses(addresses);
      setAuthenticated(true, DEV_USERNAME);
      router.replace('/(wallet)/dashboard');
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
        {/* Logo / branding */}
        <View style={styles.header}>
          <Text style={styles.logo}>⬡</Text>
          <Text style={styles.appName}>AllIn Wallet</Text>
          <Text style={styles.tagline}>Your keys. Your coins.</Text>
        </View>

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
              <Text
                style={[
                  styles.toggleText,
                  mode === m && styles.toggleTextActive,
                ]}
              >
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
              onChangeText={(t) => {
                setPassword(t);
                setPwError('');
              }}
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

        {/* Caution message */}
        <View style={styles.caution}>
          <Text style={styles.cautionText}>
            🔒 AllIn Wallet is fully non-custodial. We never have access to your
            keys or funds. Never share your seed phrase or PIN with anyone.
          </Text>
        </View>

        {/* Dev shortcut — visible only in dev builds */}
        <DevShortcut
          label={`Skip login with dev credentials\n(${DEV_USERNAME} / ${DEV_PASSWORD})`}
          actionLabel="Dev Login (1 tap)"
          onAction={handleDevLogin}
        />
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
  logo: { fontSize: 56, color: COLORS.primary },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
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
  toggleText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
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
});
