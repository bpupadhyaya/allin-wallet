import React from 'react';
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
import { clearAllData } from '../../src/services/storage';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';
import { APP_VERSION, IS_DEV } from '../../src/constants/config';

function SettingRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <Text style={styles.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function Settings() {
  const { logout, username, walletType, addresses } = useAppStore();

  function handleLogout() {
    Alert.alert('Lock Wallet', 'Lock your wallet and return to the login screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lock',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function handleDeleteWallet() {
    Alert.alert(
      '⚠️ Delete Wallet',
      'This will permanently erase all wallet data from this device. Make sure you have your seed phrase backed up.\n\nThis action CANNOT be undone.',
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Account info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{username ?? '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Wallet type</Text>
              <Text style={styles.infoValue}>{walletType ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Security</Text>
          <View style={styles.card}>
            <SettingRow icon="🔑" label="Change Password" onPress={() => Alert.alert('Coming Soon', 'Password change will be in the next release.')} />
            <SettingRow icon="🔢" label="Change PIN" onPress={() => Alert.alert('Coming Soon', 'PIN change will be in the next release.')} />
            <SettingRow icon="🔒" label="Lock Wallet" onPress={handleLogout} />
          </View>
        </View>

        {/* Network */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Network</Text>
          <View style={styles.card}>
            <SettingRow icon="⚙️" label="RPC Endpoints" onPress={() => Alert.alert('Coming Soon', 'Custom RPC configuration will be in the next release.')} />
          </View>
        </View>

        {/* Dev mode indicator */}
        {IS_DEV ? (
          <View style={styles.devBanner}>
            <Text style={styles.devText}>🛠 Developer Mode Active</Text>
            <Text style={styles.devSubtext}>
              Dev shortcuts are visible on onboarding screens.
              This banner is not shown in production.
            </Text>
          </View>
        ) : null}

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: COLORS.danger }]}>Danger Zone</Text>
          <View style={styles.card}>
            <SettingRow
              icon="🗑"
              label="Delete Wallet from Device"
              onPress={handleDeleteWallet}
              danger
            />
          </View>
        </View>

        {/* App info */}
        <Text style={styles.version}>AllIn Wallet v{APP_VERSION} · Non-custodial</Text>
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
    paddingBottom: SPACING.xxl,
  },
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
  rowArrow: { color: COLORS.textMuted, fontSize: 18 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  infoValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  devBanner: {
    backgroundColor: COLORS.devBg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.devIndicator,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  devText: { color: COLORS.devIndicator, fontWeight: '700', fontSize: FONT_SIZE.sm },
  devSubtext: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
  version: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
});
