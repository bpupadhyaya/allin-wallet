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
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT, DEFAULT_DISPLAY_SCALES } from '../../src/constants/theme';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';
import { APP_VERSION, IS_DEV, SESSION_TIMEOUT_MS, isTestnet } from '../../src/constants/config';
import { saveTestnetEnabled } from '../../src/services/storage';
import { deriveWalletsFromMnemonic } from '../../src/crypto/wallets';
import { getMnemonic, saveWalletAddresses, saveDisplayScales } from '../../src/services/storage';

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 2.0];

const SCALE_MIN = 0.5;
const SCALE_MAX = 2.5;

function ScaleSliderRow({
  label,
  value,
  onChange,
  previewSize,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  previewSize: number;
}) {
  const trackRef = React.useRef<View>(null);
  const pct = (value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  const displayPct = Math.round(value * 100);

  function handleTouch(pageX: number) {
    trackRef.current?.measure((_x, _y, width, _h, px) => {
      const ratio = Math.max(0, Math.min(1, (pageX - px) / width));
      const raw = SCALE_MIN + ratio * (SCALE_MAX - SCALE_MIN);
      // Round to nearest 0.05
      const rounded = Math.round(raw * 20) / 20;
      onChange(Math.max(SCALE_MIN, Math.min(SCALE_MAX, rounded)));
    });
  }

  return (
    <View style={styles.scaleRow}>
      <View style={styles.scaleHeader}>
        <Text style={styles.scaleLabel}>{label}</Text>
        <View style={styles.scaleRight}>
          <Text style={[styles.scalePreview, { fontSize: previewSize }]}>Aa</Text>
          <Text style={styles.scalePct}>{displayPct}%</Text>
        </View>
      </View>
      <View
        ref={trackRef}
        style={styles.sliderTrack}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => handleTouch(e.nativeEvent.pageX)}
        onResponderMove={(e) => handleTouch(e.nativeEvent.pageX)}
      >
        <View style={[styles.sliderFill, { width: `${pct * 100}%` }]} />
        <View style={[styles.sliderThumb, { left: `${pct * 100}%` }]} />
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelText}>50%</Text>
        <Text style={styles.sliderLabelText}>100%</Text>
        <Text style={styles.sliderLabelText}>250%</Text>
      </View>
    </View>
  );
}

function SectionLabel({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <Text style={[styles.sectionLabel, danger && { color: COLORS.danger }]}>
      {label}
    </Text>
  );
}

function CollapsibleCard({
  label,
  danger,
  children,
  defaultOpen = false,
}: {
  label: string;
  danger?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={[styles.sectionLabel, danger && { color: COLORS.danger }]}>
          {label}
        </Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.card}>{children}</View>}
    </View>
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
    useTestnet,
    setSlippage,
    setBiometricEnabled,
    setUseTestnet,
    setRecentTxs,
    setAddresses,
    setBalances,
    appFontScale,
    contentFontScale,
    navFontScale,
    uiElementScale,
    setAppFontScale,
    setContentFontScale,
    setNavFontScale,
    setUiElementScale,
    setDisplayScales,
  } = useAppStore();

  const { fontSize: scaledFs, contentSize, navSize } = useScaledTheme();

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

  async function handleTestnetToggle(value: boolean) {
    Alert.alert(
      value ? 'Switch to Testnet?' : 'Switch to Mainnet?',
      value
        ? 'This will switch to testnet networks (Sepolia, Solana Devnet, BTC Testnet4). Your BTC address will change. Balances will be reset.'
        : 'This will switch back to mainnet. Your BTC address will change back. Balances will be reset.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: value ? 'Use Testnet' : 'Use Mainnet',
          onPress: async () => {
            setUseTestnet(value);
            await saveTestnetEnabled(value);

            // Re-derive addresses (BTC changes for testnet)
            const mnemonic = await getMnemonic();
            if (mnemonic) {
              const wallets = await deriveWalletsFromMnemonic(mnemonic);
              const addrs = {
                btc: wallets.btc.address,
                eth: wallets.eth.address,
                sol: wallets.sol.address,
              };
              setAddresses(addrs);
              await saveWalletAddresses(addrs);
            }

            // Reset balances so they get re-fetched from the right network
            setBalances({
              BTC: 0, ETH: 0, SOL: 0,
              USDC_SOL: 0, USDT_SOL: 0, USDC_ETH: 0, USDT_ETH: 0,
            });

            Alert.alert(
              'Network Changed',
              `Now using ${value ? 'testnet' : 'mainnet'}. Balances will refresh on the dashboard.`,
            );
          },
        },
      ],
    );
  }

  const timeoutMinutes = Math.round(SESSION_TIMEOUT_MS / 60000);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity
            style={styles.quickLockBtn}
            onPress={() => {
              lock();
              router.replace('/(auth)/unlock');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.quickLockIcon}>🔒</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <CollapsibleCard label="Account" defaultOpen>
          <SettingRow icon="👤" label="Username" sub={username ?? '—'} />
          <SettingRow icon="🔑" label="Wallet Type" sub={walletType ?? '—'} />
          <SettingRow
            icon="🚪"
            label="Sign Out"
            sub="Remove this account from the app"
            onPress={handleSignOut}
            danger
          />
        </CollapsibleCard>

        {/* Display */}
        <CollapsibleCard label="Display">
          <ScaleSliderRow
            label="App Font Size"
            value={appFontScale}
            onChange={setAppFontScale}
            previewSize={scaledFs.md}
          />
          <ScaleSliderRow
            label="Content Text"
            value={contentFontScale}
            onChange={setContentFontScale}
            previewSize={contentSize.md}
          />
          <ScaleSliderRow
            label="Menu / Nav"
            value={navFontScale}
            onChange={setNavFontScale}
            previewSize={navSize.md}
          />
          <ScaleSliderRow
            label="UI Elements"
            value={uiElementScale}
            onChange={setUiElementScale}
            previewSize={scaledFs.lg}
          />
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              setDisplayScales(DEFAULT_DISPLAY_SCALES);
              saveDisplayScales(DEFAULT_DISPLAY_SCALES).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.resetBtnText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </CollapsibleCard>

        {/* Security */}
        <CollapsibleCard label="Security">
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
            onPress={() => router.push('/(wallet)/change-password')}
          />
          <SettingRow
            icon="🔢"
            label="Change PIN"
            onPress={() => router.push('/(wallet)/change-pin')}
          />
          <SettingRow
            icon="🔒"
            label="Lock Wallet Now"
            onPress={handleLock}
          />
        </CollapsibleCard>

        {/* Swap preferences */}
        <CollapsibleCard label="Swap">
          <View style={styles.row}>
            <Text style={styles.rowIcon}>⚙️</Text>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Slippage Tolerance</Text>
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
        </CollapsibleCard>

        {/* Network */}
        <CollapsibleCard label="Network">
          {useTestnet && (
            <View style={styles.testnetBannerInCard}>
              <Text style={styles.testnetBannerText}>
                🧪 TESTNET MODE — No real funds. BTC Testnet4 · Sepolia · Solana Devnet
              </Text>
            </View>
          )}
          <SettingRow
            icon="🧪"
            label="Use Testnet"
            sub={useTestnet ? 'Testnet active — switch back for real transactions' : 'Switch to test networks for development'}
            rightElement={
              <Switch
                value={useTestnet}
                onValueChange={handleTestnetToggle}
                trackColor={{ false: COLORS.border, true: COLORS.warning }}
                thumbColor={COLORS.text}
              />
            }
          />
          <SettingRow
            icon="⚙️"
            label="Custom RPC Endpoints"
            onPress={() => Alert.alert('Coming Soon', 'Custom RPC in next release.')}
          />
        </CollapsibleCard>

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: FONT_WEIGHT.heavy },
  quickLockBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  quickLockIcon: { fontSize: 18 },
  section: { gap: SPACING.sm },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
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
  slippageBtnText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  slippageBtnTextActive: { color: COLORS.text },
  slippageNote: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    lineHeight: 18,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
  },
  testnetBannerInCard: {
    backgroundColor: '#1A1400',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scaleRow: {
    padding: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scaleLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  scaleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scalePreview: {
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  scalePct: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    minWidth: 40,
    textAlign: 'right',
  },
  sliderTrack: {
    height: 32,
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.bgTertiary,
    overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 12,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  sliderThumb: {
    position: 'absolute',
    top: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    marginLeft: -12,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabelText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  resetBtn: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  resetBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  testnetBanner: {
    backgroundColor: '#1A1400',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning,
    padding: SPACING.md,
  },
  testnetBannerText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    textAlign: 'center',
  },
  devBanner: {
    backgroundColor: COLORS.devBg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.devIndicator,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  devText: { color: COLORS.devIndicator, fontWeight: FONT_WEIGHT.heavy, fontSize: FONT_SIZE.sm },
  devSub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
  version: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
});
