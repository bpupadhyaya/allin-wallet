import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useAppStore } from '../../src/store/appStore';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../src/constants/theme';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';
import { COINS, COIN_LIST } from '../../src/constants/coins';

type ChainTab = 'bitcoin' | 'ethereum' | 'solana' | 'cardano' | 'dogecoin' | 'xrp' | 'polkadot' | 'polygon';

const CHAINS: { id: ChainTab; label: string; icon: string; color: string }[] = [
  { id: 'bitcoin', label: 'Bitcoin', icon: '₿', color: '#F7931A' },
  { id: 'ethereum', label: 'Ethereum', icon: 'Ξ', color: '#627EEA' },
  { id: 'solana', label: 'Solana', icon: '◎', color: '#9945FF' },
  { id: 'cardano', label: 'Cardano', icon: '₳', color: '#0033AD' },
  { id: 'dogecoin', label: 'Dogecoin', icon: 'Ð', color: '#C2A633' },
  { id: 'xrp', label: 'XRP', icon: '✕', color: '#23292F' },
  { id: 'polkadot', label: 'Polkadot', icon: '●', color: '#E6007A' },
  { id: 'polygon', label: 'Polygon', icon: '⬟', color: '#8247E5' },
];

function chainAssets(chain: ChainTab) {
  return COIN_LIST.filter((c) => c.chain === chain);
}

export default function ReceiveScreen() {
  const { addresses, walletType } = useAppStore();
  const { fontSize, contentSize, navSize, scaleFont, uiScale } = useScaledTheme();
  const [chain, setChain] = useState<ChainTab>('solana');
  const [copied, setCopied] = useState(false);

  const chainConfig = CHAINS.find((c) => c.id === chain)!;
  const chainAddressMap: Record<ChainTab, string> = {
    bitcoin: addresses?.btc ?? '',
    ethereum: addresses?.eth ?? '',
    solana: addresses?.sol ?? '',
    cardano: addresses?.ada ?? '',
    dogecoin: addresses?.doge ?? '',
    xrp: addresses?.xrp ?? '',
    polkadot: addresses?.dot ?? '',
    polygon: addresses?.pol ?? '',
  };
  const address = chainAddressMap[chain];

  const assets = chainAssets(chain);

  // Saga wallets only have a SOL address
  const isUnavailable = walletType === 'saga' && chain !== 'solana';

  async function handleCopy() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Receive</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>
          Share your address to receive crypto. Only send the correct asset to
          each address.
        </Text>

        {/* Chain tabs */}
        <View style={styles.tabs}>
          {CHAINS.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.tab, chain === c.id && { borderBottomColor: c.color }]}
              onPress={() => { setChain(c.id); setCopied(false); }}
            >
              <Text style={[styles.tabText, chain === c.id && { color: c.color }, { fontSize: navSize.sm }]}>
                {c.icon} {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isUnavailable ? (
          <View style={styles.unavailable}>
            <Text style={[styles.unavailableText, { fontSize: contentSize.sm }]}>
              ℹ️ Solana Seeker / Saga wallets only support the Solana network.
              BTC and ETH addresses are not available with a phone-key wallet.
            </Text>
          </View>
        ) : !address ? (
          <View style={styles.unavailable}>
            <Text style={[styles.unavailableText, { fontSize: contentSize.sm }]}>No address found. Reload the app.</Text>
          </View>
        ) : (
          <>
            {/* QR Code */}
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={address}
                  size={220}
                  backgroundColor={COLORS.text}
                  color="#000"
                />
              </View>
              <View style={[styles.chainBadge, { backgroundColor: chainConfig.color + '22' }]}>
                <Text style={[styles.chainBadgeText, { color: chainConfig.color, fontSize: fontSize.sm }]}>
                  {chainConfig.icon} {chainConfig.label} Network
                </Text>
              </View>
            </View>

            {/* Address */}
            <View style={styles.addrCard}>
              <Text style={[styles.addrLabel, { fontSize: navSize.xs }]}>Your {chainConfig.label} Address</Text>
              <Text style={[styles.addrText, { fontSize: fontSize.sm }]} selectable>
                {address}
              </Text>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
                <Text style={[styles.copyBtnText, { fontSize: fontSize.md }]}>
                  {copied ? '✅ Copied to clipboard!' : '📋 Copy Address'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Accepted assets */}
            <View style={styles.assetsBox}>
              <Text style={[styles.assetsTitle, { fontSize: navSize.sm }]}>Accepted on this address</Text>
              {assets.map((coin) => (
                <View key={coin.symbol} style={styles.assetRow}>
                  <View style={[styles.assetIcon, { backgroundColor: coin.color + '22', width: 28 * uiScale, height: 28 * uiScale, borderRadius: 14 * uiScale }]}>
                    <Text style={[styles.assetIconText, { color: coin.color, fontSize: scaleFont(14) }]}>{coin.icon}</Text>
                  </View>
                  <Text style={[styles.assetName, { fontSize: fontSize.sm }]}>{coin.name}</Text>
                  <Text style={[styles.assetChain, { fontSize: fontSize.xs }]}>{coin.chain}</Text>
                </View>
              ))}
            </View>

            {/* Warning */}
            <View style={styles.warning}>
              <Text style={[styles.warningTitle, { fontSize: fontSize.sm }]}>⚠️ Important</Text>
              <Text style={[styles.warningText, { fontSize: contentSize.sm }]}>
                • Only send {chainConfig.label}-based assets to this address.
                {'\n'}• Sending assets from a different chain (e.g. ETH to a
                Bitcoin address) will result in permanent loss of funds.
                {'\n'}• Always double-check the full address before sending.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: FONT_WEIGHT.heavy },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, lineHeight: 20 },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  unavailable: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  unavailableText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, lineHeight: 20 },

  qrContainer: { alignItems: 'center', gap: SPACING.md },
  qrWrapper: {
    padding: SPACING.md,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.lg,
  },
  chainBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  chainBadgeText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.heavy },

  addrCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
    alignItems: 'center',
  },
  addrLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1, textTransform: 'uppercase' },
  addrText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 22,
  },
  copyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    width: '100%',
    alignItems: 'center',
  },
  copyBtnText: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.heavy },

  assetsBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  assetsTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.heavy },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  assetIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetIconText: { fontSize: 14, fontWeight: FONT_WEIGHT.heavy },
  assetName: { color: COLORS.text, fontSize: FONT_SIZE.sm, flex: 1, fontWeight: FONT_WEIGHT.medium },
  assetChain: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  warning: {
    backgroundColor: '#1A0A0A',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger + '55',
    gap: SPACING.sm,
  },
  warningTitle: { color: COLORS.danger, fontWeight: FONT_WEIGHT.heavy, fontSize: FONT_SIZE.sm },
  warningText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
