/**
 * Credentials Setup — final onboarding step.
 *
 * Flow:
 *  Step 1 → Username + Password
 *  Step 2 → PIN setup
 *
 * After both steps, wallet addresses are derived and everything is saved
 * to secure storage. The user is then redirected to the dashboard.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../../src/store/appStore';
import {
  saveCredentials,
  savePin,
  saveWalletType,
  saveWalletAddresses,
  saveMnemonic,
  saveSagaPubkey,
} from '../../../src/services/storage';
import { deriveWalletsFromMnemonic, walletsFromSagaPublicKey } from '../../../src/crypto/wallets';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { PinPad } from '../../../src/components/PinPad';
import { DevShortcut } from '../../../src/components/DevShortcut';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../../src/constants/theme';
import {
  DEV_USERNAME,
  DEV_PASSWORD,
  DEV_PIN,
} from '../../../src/constants/config';
import { useScaledTheme } from '../../../src/hooks/useScaledTheme';

type Step = 'credentials' | 'pin' | 'confirm-pin';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters required';
  if (!/[A-Z]/.test(pw)) return 'Include at least one uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Include at least one number';
  return null;
}

export default function CredentialsSetup() {
  const {
    pendingMnemonic,
    pendingSagaPubkey,
    setAuthenticated,
    setHasWallet,
    setAddresses,
    setPendingMnemonic,
    setPendingSagaPubkey,
  } = useAppStore();
  const { fontSize, contentSize } = useScaledTheme();

  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Step 1: Validate and advance ──────────────────────────────────────────
  function handleCredentialsNext() {
    let hasError = false;
    if (username.trim().length < 3) {
      setUsernameError('Username must be at least 3 characters');
      hasError = true;
    } else {
      setUsernameError('');
    }
    const pwErr = validatePassword(password);
    if (pwErr) {
      setPasswordError(pwErr);
      hasError = true;
    } else if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      hasError = true;
    } else {
      setPasswordError('');
    }
    if (!hasError) setStep('pin');
  }

  // ── Step 2a: First PIN entry ───────────────────────────────────────────────
  function handleFirstPin(pin: string) {
    setFirstPin(pin);
    setPinError('');
    setStep('confirm-pin');
  }

  // ── Step 2b: Confirm PIN and finalise wallet creation ─────────────────────
  async function handleConfirmPin(pin: string) {
    if (pin !== firstPin) {
      setPinError('PINs do not match. Please try again.');
      setStep('pin');
      setFirstPin('');
      return;
    }
    await finalise(username.trim(), password, pin);
  }

  async function finalise(user: string, pw: string, pin: string) {
    setSaving(true);
    try {
      let walletType: 'seed' | 'saga';
      let addresses;

      if (pendingMnemonic) {
        walletType = 'seed';
        await saveMnemonic(pendingMnemonic);
        const derived = await deriveWalletsFromMnemonic(pendingMnemonic);
        addresses = {
          btc: derived.btc.address,
          eth: derived.eth.address,
          sol: derived.sol.address,
        };
      } else if (pendingSagaPubkey) {
        walletType = 'saga';
        await saveSagaPubkey(pendingSagaPubkey);
        const derived = walletsFromSagaPublicKey(pendingSagaPubkey);
        addresses = {
          btc: derived.btc.address,
          eth: derived.eth.address,
          sol: derived.sol.address,
        };
      } else {
        Alert.alert('Error', 'No wallet key found. Please restart onboarding.');
        router.replace('/(auth)/onboarding');
        return;
      }

      await Promise.all([
        saveCredentials(user, pw),
        savePin(pin),
        saveWalletType(walletType),
        saveWalletAddresses(addresses),
      ]);

      setAddresses(addresses);
      setHasWallet(true, walletType);
      setAuthenticated(true, user);
      // Clear sensitive in-memory state
      setPendingMnemonic(null);
      setPendingSagaPubkey(null);

      router.replace('/(wallet)/dashboard');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Setup Failed', msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Dev shortcut ──────────────────────────────────────────────────────────
  async function handleDevCredentials() {
    setUsername(DEV_USERNAME);
    setPassword(DEV_PASSWORD);
    setConfirmPassword(DEV_PASSWORD);
    setStep('pin');
  }

  async function handleDevPin() {
    await finalise(DEV_USERNAME, DEV_PASSWORD, DEV_PIN);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 'credentials' && (
          <>
            <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Secure Your Wallet</Text>
            <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
              Set a username and strong password. These protect access to your
              wallet on this device.
            </Text>

            <View style={styles.notice}>
              <Text style={[styles.noticeText, { fontSize: contentSize.sm }]}>
                🔒 Your password is hashed locally and never transmitted.
                AllIn cannot reset your password. Store it somewhere safe.
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Username"
                placeholder="Choose a username (min 3 chars)"
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  setUsernameError('');
                }}
                error={usernameError}
              />
              <Input
                label="Password"
                placeholder="Min 8 chars, uppercase + number"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setPasswordError('');
                }}
                isPassword
                hint="Min 8 characters, at least 1 uppercase and 1 number"
              />
              <Input
                label="Confirm Password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setPasswordError('');
                }}
                isPassword
                error={passwordError}
              />
              <Button title="Continue to PIN Setup" onPress={handleCredentialsNext} />
            </View>

            <DevShortcut
              label={`Fill dev credentials: ${DEV_USERNAME} / ${DEV_PASSWORD} (tap 2 of 3)`}
              actionLabel="Use Dev Credentials"
              onAction={handleDevCredentials}
            />
          </>
        )}

        {step === 'pin' && (
          <>
            <PinPad
              title="Set Your PIN"
              subtitle="Choose a 6-digit PIN for quick access. Don't use obvious sequences like 123456."
              onComplete={handleFirstPin}
              error={pinError}
            />
            <DevShortcut
              label={`Use dev PIN: ${DEV_PIN} — skips to dashboard (tap 3 of 3)`}
              actionLabel="Use Dev PIN"
              onAction={handleDevPin}
            />
          </>
        )}

        {step === 'confirm-pin' && (
          <PinPad
            title="Confirm Your PIN"
            subtitle="Enter your PIN again to confirm."
            onComplete={handleConfirmPin}
            error={pinError}
          />
        )}

        {saving ? (
          <View style={styles.savingOverlay}>
            <Text style={[styles.savingText, { fontSize: contentSize.sm }]}>Setting up wallet…</Text>
          </View>
        ) : null}
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
    fontWeight: FONT_WEIGHT.heavy,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  notice: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  noticeText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  form: { gap: SPACING.md },
  savingOverlay: {
    alignItems: 'center',
    padding: SPACING.md,
  },
  savingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
});
