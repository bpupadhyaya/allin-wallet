import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../../src/store/appStore';
import { fetchAllBalances } from '../../src/services/balance';
import { fetchPrices, formatUsd, formatChange, toUsd, isDepeggedStable } from '../../src/services/prices';
import { COINS, COIN_LIST, type CoinSymbol } from '../../src/constants/coins';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../src/constants/theme';
import { GasFeeBar } from '../../src/components/GasFeeBar';
import { AllocationChart } from '../../src/components/AllocationChart';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';

// ─── Portfolio total banner ───────────────────────────────────────────────────

function PortfolioBanner() {
  const { balances, prices } = useAppStore();
  const { fontSize, contentSize, navSize } = useScaledTheme();

  const total = COIN_LIST.reduce((sum, coin) => {
    return sum + toUsd(balances[coin.symbol], prices[coin.symbol]);
  }, 0);

  return (
    <View style={bannerStyles.card}>
      <Text style={[bannerStyles.label, { fontSize: navSize.xs }]}>Total Portfolio Value</Text>
      <Text style={[bannerStyles.total, { fontSize: fontSize.xxxl }]}>{formatUsd(total)}</Text>
      <Text style={[bannerStyles.sub, { fontSize: contentSize.xs }]}>Across BTC · ETH · SOL networks</Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  label: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1, textTransform: 'uppercase' },
  total: { color: COLORS.text, fontSize: FONT_SIZE.xxxl, fontWeight: FONT_WEIGHT.heavy },
  sub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
});

// ─── Coin row ─────────────────────────────────────────────────────────────────

function CoinRow({ symbol }: { symbol: CoinSymbol }) {
  const { balances, prices, priceChanges } = useAppStore();
  const { fontSize, scaleFont, uiScale } = useScaledTheme();
  const coin = COINS[symbol];
  const balance = balances[symbol];
  const price = prices[symbol];
  const change = priceChanges[symbol];
  const usdValue = toUsd(balance, price);
  const depegged = isDepeggedStable(symbol, price);

  const balanceDisplay =
    balance === 0
      ? '0'
      : balance < 0.0001
        ? balance.toExponential(3)
        : balance.toLocaleString(undefined, { maximumFractionDigits: 6 });

  const priceDisplay = price > 0
    ? price >= 1
      ? formatUsd(price)
      : `$${price.toFixed(6)}`
    : '—';

  const changeColor = change > 0 ? COLORS.success : change < 0 ? COLORS.danger : COLORS.textMuted;

  return (
    <TouchableOpacity
      style={rowStyles.row}
      onPress={() => router.push({ pathname: '/(wallet)/coin-detail', params: { symbol } })}
      activeOpacity={0.7}
    >
      <View style={[rowStyles.icon, { backgroundColor: coin.color + '22', width: 40 * uiScale, height: 40 * uiScale, borderRadius: 20 * uiScale }]}>
        <Text style={[rowStyles.iconText, { color: coin.color, fontSize: scaleFont(20) }]}>{coin.icon}</Text>
      </View>

      <View style={rowStyles.info}>
        <View style={rowStyles.nameRow}>
          <Text style={[rowStyles.name, { fontSize: fontSize.md }]}>{coin.name}</Text>
          {depegged && (
            <View style={rowStyles.depegBadge}>
              <Text style={[rowStyles.depegText, { fontSize: scaleFont(9) }]}>DE-PEG ⚠️</Text>
            </View>
          )}
        </View>
        <View style={rowStyles.priceRow}>
          <Text style={[rowStyles.price, { fontSize: fontSize.xs }]}>{priceDisplay}</Text>
          {price > 0 && (
            <Text style={[rowStyles.change, { color: changeColor, fontSize: fontSize.xs }]}>
              {formatChange(change)}
            </Text>
          )}
        </View>
      </View>

      <View style={rowStyles.balanceCol}>
        <Text style={[rowStyles.balance, { fontSize: fontSize.sm }]}>{balanceDisplay} {coin.symbol.replace('_', ' ')}</Text>
        <Text style={[rowStyles.usd, { fontSize: fontSize.xs }]}>{usdValue > 0 ? formatUsd(usdValue) : '—'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 20, fontWeight: FONT_WEIGHT.heavy },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  name: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  depegBadge: {
    backgroundColor: COLORS.danger + '33',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  depegText: { color: COLORS.danger, fontSize: 9, fontWeight: FONT_WEIGHT.heavy },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  price: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  change: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  balanceCol: { alignItems: 'flex-end', gap: 2 },
  balance: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.heavy },
  usd: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
});

// ─── Address card ─────────────────────────────────────────────────────────────

function AddressCard({ chain, address }: { chain: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const { fontSize } = useScaledTheme();
  if (!address) return null;

  async function handleCopy() {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={addrStyles.card}>
      <View style={addrStyles.row}>
        <Text style={[addrStyles.chain, { fontSize: fontSize.xs }]}>{chain.toUpperCase()}</Text>
        <TouchableOpacity onPress={handleCopy} style={addrStyles.copyBtn}>
          <Text style={[addrStyles.copyText, { fontSize: fontSize.xs }]}>{copied ? '✅ Copied' : '📋 Copy'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[addrStyles.address, { fontSize: fontSize.sm }]} numberOfLines={1} ellipsizeMode="middle">
        {address}
      </Text>
    </View>
  );
}

const addrStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chain: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1 },
  copyBtn: { padding: 4 },
  copyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  address: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontFamily: 'monospace' },
});

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const { fontSize, scaleFont } = useScaledTheme();
  return (
    <View style={qaStyles.row}>
      {[
        { icon: '⇄', label: 'Swap', route: '/(wallet)/swap' as const },
        { icon: '↓', label: 'Receive', route: '/(wallet)/receive' as const },
        { icon: '↑', label: 'Send', route: '/(wallet)/send' as const },
      ].map((action) => (
        <TouchableOpacity
          key={action.label}
          style={qaStyles.btn}
          onPress={() => router.push(action.route)}
          activeOpacity={0.7}
        >
          <Text style={[qaStyles.icon, { fontSize: scaleFont(22) }]}>{action.icon}</Text>
          <Text style={[qaStyles.label, { fontSize: fontSize.xs }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const qaStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.md },
  btn: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  icon: { fontSize: 22, color: COLORS.primary },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    username,
    addresses,
    balancesLoading,
    pricesLoading,
    setBalances,
    setBalancesLoading,
    setPrices,
    setPriceChanges,
    setPricesLoading,
    lock,
  } = useAppStore();
  const { fontSize, contentSize, navSize, scaleFont } = useScaledTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadAll = useCallback(async () => {
    const jobs: Promise<void>[] = [];

    if (addresses) {
      setBalancesLoading(true);
      jobs.push(
        fetchAllBalances(addresses)
          .then((b) => {
            setBalances(b);
            setLastUpdated(new Date());
          })
          .catch(() => {/* show stale */})
          .finally(() => setBalancesLoading(false)),
      );
    }

    setPricesLoading(true);
    jobs.push(
      fetchPrices()
        .then(({ prices, changes }) => {
          setPrices(prices);
          setPriceChanges(changes);
        })
        .catch(() => {/* keep last prices */})
        .finally(() => setPricesLoading(false)),
    );

    await Promise.allSettled(jobs);
  }, [addresses]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  const updating = balancesLoading || pricesLoading;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { fontSize: fontSize.sm }]}>Welcome back,</Text>
            <Text style={[styles.username, { fontSize: fontSize.xl }]}>{username ?? 'Wallet'}</Text>
          </View>
          <View style={styles.statusCol}>
            {updating ? (
              <Text style={[styles.statusText, { fontSize: fontSize.xs }]}>Syncing…</Text>
            ) : lastUpdated ? (
              <Text style={[styles.statusText, { fontSize: fontSize.xs }]}>
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : null}
            <View style={styles.badgeRow}>
              <View style={styles.custodyBadge}>
                <Text style={[styles.custodyText, { fontSize: scaleFont(10) }]}>🔐 Self-custody</Text>
              </View>
              <TouchableOpacity
                style={styles.lockBtn}
                onPress={() => { lock(); router.replace('/(auth)/unlock'); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.lockBtnText, { fontSize: scaleFont(10) }]}>🔒 Lock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Portfolio total */}
        <PortfolioBanner />

        {/* Quick actions */}
        <QuickActions />

        {/* Gas fee bar */}
        <GasFeeBar />

        {/* Assets */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: navSize.xs }]}>Assets</Text>
          <View style={styles.coinList}>
            {COIN_LIST.map((c) => (
              <CoinRow key={c.symbol} symbol={c.symbol} />
            ))}
          </View>
        </View>

        {/* Addresses */}
        {addresses && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { fontSize: navSize.xs }]}>Receiving Addresses</Text>
            <Text style={[styles.addrNote, { fontSize: contentSize.xs }]}>
              ⚠️ Only send the matching asset to each address. Sending the wrong
              asset may result in permanent loss.
            </Text>
            {addresses.btc ? <AddressCard chain="bitcoin" address={addresses.btc} /> : null}
            {addresses.eth ? <AddressCard chain="ethereum" address={addresses.eth} /> : null}
            {addresses.sol ? <AddressCard chain="solana" address={addresses.sol} /> : null}
          </View>
        )}

        {/* Portfolio allocation chart */}
        <AllocationChart />

        {/* Security reminder */}
        <View style={styles.caution}>
          <Text style={[styles.cautionText, { fontSize: contentSize.xs }]}>
            ⚠️ Crypto transactions are irreversible. Always verify the recipient
            address before sending. AllIn Wallet cannot recover lost funds.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  username: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.heavy },
  statusCol: { alignItems: 'flex-end', gap: SPACING.xs },
  statusText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  custodyBadge: {
    backgroundColor: '#0A1A12',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.success + '44',
  },
  custodyText: { color: COLORS.success, fontSize: 10, fontWeight: FONT_WEIGHT.bold },
  lockBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lockBtnText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: FONT_WEIGHT.bold },

  section: { gap: SPACING.sm },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  coinList: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  addrNote: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 16 },
  caution: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  cautionText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
