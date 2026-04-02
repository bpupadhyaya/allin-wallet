import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { fetchAllBalances } from '../../src/services/balance';
import { COINS, COIN_LIST, type CoinSymbol } from '../../src/constants/coins';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';

// ─── Coin row ────────────────────────────────────────────────────────────────

function CoinRow({ symbol }: { symbol: CoinSymbol }) {
  const balances = useAppStore((s) => s.balances);
  const coin = COINS[symbol];
  const balance = balances[symbol];
  const display = balance > 0
    ? balance < 0.0001
      ? balance.toExponential(4)
      : balance.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : '0';

  return (
    <View style={styles.coinRow}>
      <View style={[styles.coinIcon, { backgroundColor: coin.color + '22' }]}>
        <Text style={[styles.coinIconText, { color: coin.color }]}>{coin.icon}</Text>
      </View>
      <View style={styles.coinInfo}>
        <Text style={styles.coinName}>{coin.name}</Text>
        <Text style={styles.coinChain}>{coin.chain}</Text>
      </View>
      <View style={styles.coinBalance}>
        <Text style={styles.balanceAmount}>{display}</Text>
        <Text style={styles.balanceSymbol}>{coin.symbol}</Text>
      </View>
    </View>
  );
}

// ─── Address card ─────────────────────────────────────────────────────────────

function AddressCard({ chain, address }: { chain: string; address: string }) {
  if (!address) return null;
  return (
    <View style={styles.addrCard}>
      <Text style={styles.addrChain}>{chain.toUpperCase()}</Text>
      <Text style={styles.addrText} numberOfLines={1} ellipsizeMode="middle">
        {address}
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    username,
    addresses,
    balancesLoading,
    setBalances,
    setBalancesLoading,
  } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadBalances = useCallback(async () => {
    if (!addresses) return;
    setBalancesLoading(true);
    try {
      const b = await fetchAllBalances(addresses);
      setBalances(b);
      setLastUpdated(new Date());
    } catch (e) {
      // Silently fail — stale balances are shown; user can refresh
    } finally {
      setBalancesLoading(false);
    }
  }, [addresses]);

  // Load on first focus
  useFocusEffect(
    useCallback(() => {
      loadBalances();
    }, [loadBalances]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadBalances();
    setRefreshing(false);
  }

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
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username}>{username ?? 'Wallet'}</Text>
          </View>
          <View style={styles.refreshHint}>
            {balancesLoading ? (
              <Text style={styles.refreshText}>Updating…</Text>
            ) : lastUpdated ? (
              <Text style={styles.refreshText}>
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Non-custodial notice */}
        <View style={styles.selfCustodyBadge}>
          <Text style={styles.selfCustodyText}>
            🔐 Self-custody · Your keys, your coins · No third-party access
          </Text>
        </View>

        {/* Coin balances */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Assets</Text>
          <View style={styles.coinList}>
            {COIN_LIST.map((coin) => (
              <CoinRow key={coin.symbol} symbol={coin.symbol} />
            ))}
          </View>
        </View>

        {/* Receiving addresses */}
        {addresses ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receiving Addresses</Text>
            <Text style={styles.sectionSubtitle}>
              Only send the matching coin to each address. Sending the wrong
              asset to an address may result in permanent loss of funds.
            </Text>
            {addresses.btc ? (
              <AddressCard chain="bitcoin" address={addresses.btc} />
            ) : null}
            {addresses.eth ? (
              <AddressCard chain="ethereum" address={addresses.eth} />
            ) : null}
            {addresses.sol ? (
              <AddressCard chain="solana" address={addresses.sol} />
            ) : null}
          </View>
        ) : null}

        {/* Security reminder */}
        <View style={styles.caution}>
          <Text style={styles.cautionText}>
            ⚠️ Never send funds to an address you don't control. Double-check
            addresses before any transaction. Crypto transactions are
            irreversible.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  username: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '800' },
  refreshHint: { alignItems: 'flex-end' },
  refreshText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  selfCustodyBadge: {
    backgroundColor: '#0A1A12',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.success + '44',
  },
  selfCustodyText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },

  section: { gap: SPACING.sm },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    lineHeight: 16,
  },

  coinList: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  coinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinIconText: { fontSize: 20, fontWeight: '700' },
  coinInfo: { flex: 1, gap: 2 },
  coinName: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' },
  coinChain: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  coinBalance: { alignItems: 'flex-end', gap: 2 },
  balanceAmount: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
  balanceSymbol: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  addrCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  addrChain: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  addrText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
  },

  caution: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  cautionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
});
