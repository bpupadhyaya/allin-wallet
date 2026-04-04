/**
 * Unlock screen — shown when the wallet is locked (session timeout or manual lock).
 *
 * Priority:  biometric (auto-prompt) → PIN pad → password fallback
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  getBiometricType,
  authenticateWithBiometrics,
} from '../../src/services/biometric';
import { verifyPin, verifyPassword } from '../../src/services/storage';
import { PinPad } from '../../src/components/PinPad';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../src/constants/theme';
import { DevShortcut } from '../../src/components/DevShortcut';
import { DEV_PIN } from '../../src/constants/config';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';

type Mode = 'pin' | 'password';

export default function UnlockScreen() {
  const { unlock, logout, username } = useAppStore();
  const { fontSize, contentSize, scaleFont } = useScaledTheme();
  const [mode, setMode] = useState<Mode>('pin');
  const [pinError, setPinError] = useState('');
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    async function init() {
      const available = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();
      if (available && enabled) {
        setBioAvailable(true);
        setBioLabel(await getBiometricType());
        handleBiometric();
      }
    }
    init();
  }, []);

  async function handleBiometric() {
    try {
      const ok = await authenticateWithBiometrics('Unlock AllIn Wallet');
      if (ok) {
        unlock();
        router.replace('/(wallet)/dashboard');
      }
    } catch {
      // Fall through to PIN
    }
  }

  async function handlePinComplete(pin: string) {
    setPinError('');
    try {
      const ok = await verifyPin(pin);
      if (!ok) { setPinError('Incorrect PIN. Try again.'); return; }
      unlock();
      router.replace('/(wallet)/dashboard');
    } catch {
      setPinError('PIN verification failed. Try your password.');
    }
  }

  async function handlePasswordUnlock() {
    if (!password) { setPwError('Please enter your password'); return; }
    setLoading(true);
    setPwError('');
    try {
      const ok = await verifyPassword(password);
      if (!ok) { setPwError('Incorrect password'); return; }
      unlock();
      router.replace('/(wallet)/dashboard');
    } catch {
      setPwError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'This will sign you out completely. You will need your seed phrase or credentials to restore access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/onboarding');
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View style={styles.header}>
          <Text style={[styles.logo, { fontSize: scaleFont(52) }]}>⬡</Text>
          <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Wallet Locked</Text>
          {username ? (
            <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>Welcome back, {username}</Text>
          ) : null}
        </View>

        {/* Biometric quick-unlock */}
        {bioAvailable && (
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometric}
            activeOpacity={0.7}
          >
            <Text style={[styles.biometricIcon, { fontSize: scaleFont(24) }]}>
              {bioLabel === 'Face ID' ? '🔭' : '👆'}
            </Text>
            <Text style={[styles.biometricText, { fontSize: fontSize.md }]}>Unlock with {bioLabel}</Text>
          </TouchableOpacity>
        )}

        {/* Mode toggle — only show if PIN exists (default primary) */}
        <View style={styles.toggleRow}>
          {(['pin', 'password'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleActive]}
              onPress={() => {
                setMode(m);
                setPinError('');
                setPwError('');
              }}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive, { fontSize: fontSize.sm }]}>
                {m === 'pin' ? '🔢 PIN' : '🔑 Password'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'pin' ? (
          <>
            <PinPad
              title="Enter PIN"
              subtitle="Use your 6-digit PIN to unlock"
              onComplete={handlePinComplete}
              error={pinError}
            />
            <DevShortcut
              label="Auto-fill dev PIN and unlock"
              actionLabel="Dev Unlock (1 tap)"
              onAction={() => handlePinComplete(DEV_PIN)}
            />
          </>
        ) : (
          <View style={styles.form}>
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(t) => { setPassword(t); setPwError(''); }}
              isPassword
              error={pwError}
              onSubmitEditing={handlePasswordUnlock}
            />
            <Button
              title="Unlock Wallet"
              onPress={handlePasswordUnlock}
              loading={loading}
            />
          </View>
        )}

        {/* Sign out link */}
        <TouchableOpacity style={styles.signOutLink} onPress={handleSignOut}>
          <Text style={[styles.signOutText, { fontSize: fontSize.sm }]}>Sign out →</Text>
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

  header: { alignItems: 'center', gap: SPACING.sm },
  logo: { fontSize: 52, color: COLORS.primary },
  title: {
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.heavy,
  },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },

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
    fontWeight: FONT_WEIGHT.heavy,
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
    fontWeight: FONT_WEIGHT.bold,
  },
  toggleTextActive: { color: COLORS.text },

  form: { gap: SPACING.md },

  signOutLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  signOutText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
});
