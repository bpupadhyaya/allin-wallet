import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { clearAllData } from '../../src/services/storage';
import {
  isBiometricAvailable,
  getBiometricType,
  setBiometricEnabled as persistBiometricEnabled,
  isBiometricEnabled,
} from '../../src/services/biometric';
import { clearTxHistory } from '../../src/services/txHistory';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';
import { APP_VERSION, IS_DEV, SESSION_TIMEOUT_MS } from '../../src/constants/config';

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 2.0];

function SectionLabel({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <Text style={[styles.sectionLabel, danger && { color: COLORS.danger }]}>
      {label}
    </Text>
  );
}

function SettingRow({
  icon,
  label,
  sub,
  onPress,
  danger,
  rightElement,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightElement}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {rightElement ?? (onPress ? <Text style={styles.rowArrow}>›</Text> : null)}
    </TouchableOpacity>
  );
}

export default function Settings() {
  const {
    logout,
    lock,
    username,
    walletType,
    slippagePct,
    biometricEnabled,
    setSlippage,
    setBiometricEnabled,
    setRecentTxs,
  } = useAppStore();

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');

  useEffect(() => {
    async function loadBio() {
      const available = await isBiometricAvailable();
      if (available) {
        setBioAvailable(true);
        setBioLabel(await getBiometricType());
        const enabled = await isBiometricEnabled();
        setBiometricEnabled(enabled);
      }
    }
    loadBio();
  }, []);

  async function handleBioToggle(value: boolean) {
    setBiometricEnabled(value);
    await persistBiometricEnabled(value);
  }

  function handleLock() {
    Alert.alert('Lock Wallet', 'Lock wallet and require PIN to re-enter?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lock',
        onPress: () => {
          lock();
          router.replace('/(auth)/unlock');
        },
      },
    ]);
  }

  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Sign out completely? Your wallet will remain on this device — use your credentials to sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }

  function handleClearHistory() {
    Alert.alert(
      'Clear History',
      'Remove all local transaction history? This only clears the record in this app — your on-chain transactions remain permanent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearTxHistory();
            setRecentTxs([]);
          },
        },
      ],
    );
  }

  function handleDeleteWallet() {
    Alert.alert(
      '⚠️ Delete Wallet from This Device',
      'This will permanently erase your wallet data, credentials, and seed phrase from this device.\n\n• Make sure you have your seed phrase backed up before proceeding.\n• This does NOT affect funds on-chain.\n• This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Wallet',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            logout();
            router.replace('/(auth)/onboarding');
          },
        },
      ],
    );
  }

  const timeoutMinutes = Math.round(SESSION_TIMEOUT_MS / 60000);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Account */}
        <View style={styles.section}>
          <SectionLabel label="Account" />
          <View style={styles.card}>
            <SettingRow icon="👤" label="Username" sub={username ?? '—'} />
            <SettingRow icon="🔑" label="Wallet Type" sub={walletType ?? '—'} />
            <SettingRow
              icon="🚪"
              label="Sign Out"
              sub="Remove this account from the app"
              onPress={handleSignOut}
              danger
            />
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <SectionLabel label="Security" />
          <View style={styles.card}>
            {bioAvailable && (
              <SettingRow
                icon={bioLabel === 'Face ID' ? '🔭' : '👆'}
                label={`Unlock with ${bioLabel}`}
                sub="Use biometrics instead of password on login"
                rightElement={
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleBioToggle}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={COLORS.text}
                  />
                }
              />
            )}
            <SettingRow
              icon="⏱"
              label="Auto-lock"
              sub={`Wallet locks after ${timeoutMinutes} minutes in background`}
            />
            <SettingRow
              icon="🔑"
              label="Change Password"
              onPress={() => Alert.alert('Coming Soon', 'Password change in next release.')}
            />
            <SettingRow
              icon="🔢"
              label="Change PIN"
              onPress={() => Alert.alert('Coming Soon', 'PIN change in next release.')}
            />
            <SettingRow
              icon="🔒"
              label="Lock Wallet Now"
              onPress={handleLock}
            />
          </View>
        </View>

        {/* Swap preferences */}
        <View style={styles.section}>
          <SectionLabel label="Swap" />
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowIcon}>⚙️</Text>
              <Text style={styles.rowLabel} style={{ flex: 1 }}>Slippage Tolerance</Text>
            </View>
            <View style={styles.slippageRow}>
              {SLIPPAGE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.slippageBtn,
                    slippagePct === opt && styles.slippageBtnActive,
                  ]}
                  onPress={() => setSlippage(opt)}
                >
                  <Text
                    style={[
                      styles.slippageBtnText,
                      slippagePct === opt && styles.slippageBtnTextActive,
                    ]}
                  >
                    {opt}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.slippageNote}>
              {slippagePct < 0.5
                ? '⚠️ Low slippage may cause failed transactions in volatile markets.'
                : slippagePct > 1
                  ? '⚠️ High slippage increases exposure to price impact and front-running.'
                  : '✅ Recommended for most trades.'}
            </Text>
          </View>
        </View>

        {/* Network */}
        <View style={styles.section}>
          <SectionLabel label="Network" />
          <View style={styles.card}>
            <SettingRow
              icon="⚙️"
              label="Custom RPC Endpoints"
              onPress={() => Alert.alert('Coming Soon', 'Custom RPC in next release.')}
            />
          </View>
        </View>

        {/* History */}
        <View style={styles.section}>
          <SectionLabel label="Data" />
          <View style={styles.card}>
            <SettingRow
              icon="🗑"
              label="Clear Transaction History"
              sub="Removes local history — does not affect the blockchain"
              onPress={handleClearHistory}
            />
          </View>
        </View>

        {/* Dev mode indicator */}
        {IS_DEV && (
          <View style={styles.devBanner}>
            <Text style={styles.devText}>🛠 Developer Mode Active</Text>
            <Text style={styles.devSub}>
              Dev shortcuts visible on onboarding and login screens.
              This banner does not appear in production builds.
            </Text>
          </View>
        )}

        {/* Danger zone */}
        <View style={styles.section}>
          <SectionLabel label="Danger Zone" danger />
          <View style={styles.card}>
            <SettingRow
              icon="🗑"
              label="Delete Wallet from Device"
              sub="Permanently erases all wallet data. Have your seed phrase ready."
              onPress={handleDeleteWallet}
              danger
            />
          </View>
        </View>

        <Text style={styles.version}>AllIn Wallet v{APP_VERSION} · Non-custodial · Open source</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: '800' },
  section: { gap: SPACING.sm },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowIcon: { fontSize: 18 },
  rowLabel: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.md },
  rowLabelDanger: { color: COLORS.danger },
  rowSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  rowArrow: { color: COLORS.textMuted, fontSize: 18 },
  slippageRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  slippageBtn: {
    flex: 1,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  slippageBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slippageBtnText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  slippageBtnTextActive: { color: COLORS.text },
  slippageNote: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    lineHeight: 18,
  },
  devBanner: {
    backgroundColor: COLORS.devBg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.devIndicator,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  devText: { color: COLORS.devIndicator, fontWeight: '700', fontSize: FONT_SIZE.sm },
  devSub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
  version: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
});
