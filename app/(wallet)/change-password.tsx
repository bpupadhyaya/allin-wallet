import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyPassword, getUsername, saveCredentials } from '../../src/services/storage';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters required';
  if (!/[A-Z]/.test(pw)) return 'Include at least one uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Include at least one number';
  return null;
}

export default function ChangePassword() {
  const { lock } = useAppStore();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!currentPw) { setError('Enter your current password'); return; }

    const pwErr = validatePassword(newPw);
    if (pwErr) { setError(pwErr); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match'); return; }
    if (newPw === currentPw) { setError('New password must be different'); return; }

    setSaving(true);
    try {
      const ok = await verifyPassword(currentPw);
      if (!ok) { setError('Current password is incorrect'); return; }

      const username = await getUsername();
      if (!username) { setError('Could not load username'); return; }

      await saveCredentials(username, newPw);
      Alert.alert('Password Changed', 'Your password has been updated. Please sign in with your new password.', [
        {
          text: 'OK',
          onPress: () => {
            lock();
            router.replace('/(auth)/unlock');
          },
        },
      ]);
    } catch {
      setError('Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Change Password</Text>
        <Text style={styles.subtitle}>
          Enter your current password, then choose a new one.
        </Text>

        <View style={styles.form}>
          <Input
            label="Current Password"
            placeholder="Enter current password"
            value={currentPw}
            onChangeText={(t) => { setCurrentPw(t); setError(''); }}
            isPassword
          />
          <Input
            label="New Password"
            placeholder="Min 8 chars, uppercase + number"
            value={newPw}
            onChangeText={(t) => { setNewPw(t); setError(''); }}
            isPassword
            hint="Min 8 characters, at least 1 uppercase and 1 number"
          />
          <Input
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirmPw}
            onChangeText={(t) => { setConfirmPw(t); setError(''); }}
            isPassword
            error={error}
          />
          <Button title="Change Password" onPress={handleSubmit} loading={saving} />
          <Button title="Cancel" variant="outline" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg },
  title: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: FONT_WEIGHT.heavy },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  form: { gap: SPACING.md },
});
