import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyPin, savePin } from '../../src/services/storage';
import { PinPad } from '../../src/components/PinPad';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';

type Step = 'current' | 'new' | 'confirm';

function validatePin(pin: string): string | null {
  if (/^(.)\1{5}$/.test(pin)) return 'PIN cannot be all the same digit';
  const seq = '0123456789';
  const rev = '9876543210';
  if (seq.includes(pin) || rev.includes(pin)) return 'PIN cannot be a sequential pattern';
  return null;
}

export default function ChangePin() {
  const { lock } = useAppStore();
  const [step, setStep] = useState<Step>('current');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');

  async function handleCurrentPin(pin: string) {
    setError('');
    const ok = await verifyPin(pin);
    if (!ok) { setError('Incorrect current PIN'); return; }
    setStep('new');
  }

  function handleNewPin(pin: string) {
    const err = validatePin(pin);
    if (err) { setError(err); return; }
    setError('');
    setNewPin(pin);
    setStep('confirm');
  }

  async function handleConfirmPin(pin: string) {
    if (pin !== newPin) {
      setError('PINs do not match. Try again.');
      setStep('new');
      setNewPin('');
      return;
    }
    try {
      await savePin(pin);
      Alert.alert('PIN Changed', 'Your PIN has been updated.', [
        {
          text: 'OK',
          onPress: () => {
            lock();
            router.replace('/(auth)/unlock');
          },
        },
      ]);
    } catch {
      setError('Failed to change PIN. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 'current' && (
          <PinPad
            title="Enter Current PIN"
            subtitle="Verify your current 6-digit PIN"
            onComplete={handleCurrentPin}
            error={error}
          />
        )}
        {step === 'new' && (
          <PinPad
            title="Enter New PIN"
            subtitle="Choose a new 6-digit PIN. Avoid sequential or repeated digits."
            onComplete={handleNewPin}
            error={error}
          />
        )}
        {step === 'confirm' && (
          <PinPad
            title="Confirm New PIN"
            subtitle="Enter your new PIN again to confirm."
            onComplete={handleConfirmPin}
            error={error}
          />
        )}
        <Button title="Cancel" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg },
});
