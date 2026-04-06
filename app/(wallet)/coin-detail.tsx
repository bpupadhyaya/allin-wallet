/**
 * Coin Detail Screen — shown when user taps a coin row on the dashboard.
 * Provides coin-specific actions: Receive, Send, Swap, and recent history.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAppStore, type TxRecord } from '../../src/store/appStore';
import { COINS, COIN_LIST, type CoinSymbol, type ChainId } from '../../src/constants/coins';
import { formatUsd, formatChange, toUsd, isDepeggedStable } from '../../src/services/prices';
import { getExplorerTxUrl } from '../../src/constants/config';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../src/constants/theme';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';

// Map chain to address key in the store
const CHAIN_ADDRESS_KEY: Record<ChainId, string> = {
  bitcoin: 'btc',
  ethereum: 'eth',
  solana: 'sol',
  cardano: 'ada',
  dogecoin: 'doge',
  xrp: 'xrp',
  polkadot: 'dot',
  polygon: 'pol',
};

export default function CoinDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { balances, prices, priceChanges, addresses, recentTxs } = useAppStore();
  const { fontSize, contentSize, scaleFont, uiScale } = useScaledTheme();
  const [copied, setCopied] = React.useState(false);

  const coinSymbol = symbol as CoinSymbol;
  const coin = COINS[coinSymbol];
  if (!coin) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.errorText}>Unknown coin: {symbol}</Text>
      </SafeAreaView>
    );
  }

  const balance = balances[coinSymbol] ?? 0;
  const price = prices[coinSymbol] ?? 0;
  const change = priceChanges[coinSymbol] ?? 0;
  const usdValue = toUsd(balance, price);
  const depegged = isDepeggedStable(coinSymbol, price);
  const changeColor = change > 0 ? COLORS.success : change < 0 ? COLORS.danger : COLORS.textMuted;

  // Get the address for this coin's chain
  const addrKey = CHAIN_ADDRESS_KEY[coin.chain] as keyof typeof addresses;
  const address = addresses?.[addrKey] ?? '';

  // Same-chain coins (e.g. ETH and USDC_ETH share Ethereum)
  const sameChainCoins = COIN_LIST.filter(
    (c) => c.chain === coin.chain && c.symbol !== coinSymbol,
  );

  // Coin-specific transaction history
  const coinTxs = recentTxs.filter(
    (tx) => tx.fromCoin === coinSymbol || tx.toCoin === coinSymbol,
  );

  const balanceDisplay =
    balance === 0
      ? '0'
      : balance < 0.0001
        ? balance.toExponential(3)
        : balance.toLocaleString(undefined, { maximumFractionDigits: 6 });

  const priceDisplay =
    price > 0 ? (price >= 1 ? formatUsd(price) : `$${price.toFixed(6)}`) : '—';

  async function handleCopyAddress() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { fontSize: fontSize.sm }]}>← Back</Text>
        </TouchableOpacity>

        {/* Coin header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: coin.color + '22',
                width: 64 * uiScale,
                height: 64 * uiScale,
                borderRadius: 32 * uiScale,
              },
            ]}
          >
            <Text style={{ color: coin.color, fontSize: scaleFont(32), fontWeight: FONT_WEIGHT.heavy }}>
              {coin.icon}
            </Text>
          </View>
          <Text style={[styles.coinName, { fontSize: fontSize.xxl }]}>{coin.name}</Text>
          <Text style={[styles.coinSymbol, { fontSize: fontSize.sm }]}>
            {coinSymbol.replace('_', ' ')} · {coin.chain}
          </Text>
          {depegged && (
            <View style={styles.depegBadge}>
              <Text style={[styles.depegText, { fontSize: scaleFont(11) }]}>DE-PEG WARNING</Text>
            </View>
          )}
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={[styles.balanceLabel, { fontSize: contentSize.xs }]}>Your Balance</Text>
          <Text style={[styles.balanceAmount, { fontSize: fontSize.xxxl }]}>
            {balanceDisplay}
          </Text>
          <Text style={[styles.balanceUsd, { fontSize: fontSize.md }]}>
            {usdValue > 0 ? formatUsd(usdValue) : '$0.00'}
          </Text>
        </View>

        {/* Price info */}
        <View style={styles.priceRow}>
          <View style={styles.priceItem}>
            <Text style={[styles.priceLabel, { fontSize: contentSize.xs }]}>Price</Text>
            <Text style={[styles.priceValue, { fontSize: fontSize.md }]}>{priceDisplay}</Text>
          </View>
          <View style={styles.priceItem}>
            <Text style={[styles.priceLabel, { fontSize: contentSize.xs }]}>24h Change</Text>
            <Text style={[styles.priceValue, { color: changeColor, fontSize: fontSize.md }]}>
              {formatChange(change)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          {[
            { icon: '↓', label: 'Receive', onPress: () => router.push('/(wallet)/receive') },
            { icon: '↑', label: 'Send', onPress: () => router.push('/(wallet)/send') },
            { icon: '⇄', label: 'Swap', onPress: () => router.push('/(wallet)/swap') },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionBtn, { borderColor: coin.color + '44' }]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionIcon, { color: coin.color, fontSize: scaleFont(24) }]}>
                {action.icon}
              </Text>
              <Text style={[styles.actionLabel, { fontSize: fontSize.xs }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Address */}
        {address ? (
          <TouchableOpacity style={styles.addressCard} onPress={handleCopyAddress} activeOpacity={0.7}>
            <View style={styles.addressHeader}>
              <Text style={[styles.addressLabel, { fontSize: contentSize.xs }]}>
                {coin.chain.toUpperCase()} ADDRESS
              </Text>
              <Text style={[styles.copyHint, { fontSize: contentSize.xs }]}>
                {copied ? '✅ Copied' : '📋 Tap to copy'}
              </Text>
            </View>
            <Text style={[styles.addressText, { fontSize: fontSize.sm }]} numberOfLines={1} ellipsizeMode="middle">
              {address}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Same-chain assets */}
        {sameChainCoins.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { fontSize: contentSize.xs }]}>
              OTHER {coin.chain.toUpperCase()} ASSETS
            </Text>
            <View style={styles.sameChainList}>
              {sameChainCoins.map((c) => {
                const bal = balances[c.symbol] ?? 0;
                const usd = toUsd(bal, prices[c.symbol] ?? 0);
                return (
                  <TouchableOpacity
                    key={c.symbol}
                    style={styles.sameChainRow}
                    onPress={() => router.push({ pathname: '/(wallet)/coin-detail', params: { symbol: c.symbol } })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.miniIcon, { backgroundColor: c.color + '22' }]}>
                      <Text style={{ color: c.color, fontSize: scaleFont(14) }}>{c.icon}</Text>
                    </View>
                    <Text style={[styles.sameChainName, { fontSize: fontSize.sm }]}>{c.name}</Text>
                    <Text style={[styles.sameChainBal, { fontSize: fontSize.xs }]}>
                      {usd > 0 ? formatUsd(usd) : '—'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent transactions for this coin */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: contentSize.xs }]}>RECENT ACTIVITY</Text>
          {coinTxs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { fontSize: contentSize.sm }]}>
                No transactions yet for {coin.name}.
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {coinTxs.slice(0, 10).map((tx) => (
                <TxRow key={tx.id} tx={tx} coinSymbol={coinSymbol} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({ tx, coinSymbol }: { tx: TxRecord; coinSymbol: CoinSymbol }) {
  const { fontSize, scaleFont } = useScaledTheme();
  const isSend = tx.type === 'send';
  const isFrom = tx.fromCoin === coinSymbol;
  const statusColor =
    tx.status === 'confirmed' ? COLORS.success : tx.status === 'failed' ? COLORS.danger : COLORS.warning;

  const label = isSend
    ? `Sent ${tx.fromCoin.replace('_', ' ')}`
    : `Swap ${tx.fromCoin.replace('_', ' ')} → ${tx.toCoin.replace('_', ' ')}`;

  const amount = isFrom ? `-${tx.fromAmount}` : `+${tx.toAmount}`;
  const amountColor = isFrom ? COLORS.danger : COLORS.success;

  const timeStr = tx.timestamp
    ? new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  return (
    <TouchableOpacity
      style={txStyles.row}
      onPress={() => tx.explorerUrl && Linking.openURL(tx.explorerUrl)}
      activeOpacity={0.7}
    >
      <View style={txStyles.left}>
        <Text style={[txStyles.label, { fontSize: fontSize.sm }]}>{label}</Text>
        <View style={txStyles.metaRow}>
          <View style={[txStyles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[txStyles.meta, { fontSize: fontSize.xs }]}>
            {tx.status} {timeStr ? `· ${timeStr}` : ''}
          </Text>
        </View>
      </View>
      <Text style={[txStyles.amount, { color: amountColor, fontSize: fontSize.sm }]}>{amount}</Text>
    </TouchableOpacity>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  left: { flex: 1, gap: 2 },
  label: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  meta: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  amount: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  errorText: { color: COLORS.danger, textAlign: 'center', marginTop: 40 },

  backBtn: { alignSelf: 'flex-start' },
  backText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  header: { alignItems: 'center', gap: SPACING.xs },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  coinName: { color: COLORS.text, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.heavy },
  coinSymbol: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textTransform: 'capitalize' },
  depegBadge: {
    backgroundColor: COLORS.danger + '33',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  depegText: { color: COLORS.danger, fontWeight: FONT_WEIGHT.heavy },

  balanceCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  balanceLabel: { color: COLORS.textMuted, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1, textTransform: 'uppercase' },
  balanceAmount: { color: COLORS.text, fontSize: FONT_SIZE.xxxl, fontWeight: FONT_WEIGHT.heavy },
  balanceUsd: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },

  priceRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  priceItem: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 4,
  },
  priceLabel: { color: COLORS.textMuted, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  priceValue: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.heavy },

  actionsRow: { flexDirection: 'row', gap: SPACING.md },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  actionIcon: { fontSize: 24 },
  actionLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  addressCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressLabel: { color: COLORS.primary, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1 },
  copyHint: { color: COLORS.textMuted },
  addressText: { color: COLORS.textSecondary, fontFamily: 'monospace' },

  section: { gap: SPACING.sm },
  sectionLabel: { color: COLORS.textMuted, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1 },

  sameChainList: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  sameChainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  miniIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sameChainName: { flex: 1, color: COLORS.text, fontWeight: FONT_WEIGHT.medium },
  sameChainBal: { color: COLORS.textSecondary },

  emptyBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: { color: COLORS.textMuted },

  txList: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
});
