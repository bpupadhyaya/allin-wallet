import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, type TxRecord } from '../../src/store/appStore';
import { loadTxHistory } from '../../src/services/txHistory';
import { formatUsd, toUsd } from '../../src/services/prices';
import { COINS } from '../../src/constants/coins';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';

type Filter = 'all' | 'swap' | 'send';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TxRecord['status'] }) {
  const config = {
    pending: { color: COLORS.warning, label: 'Pending', bg: '#2A1A00' },
    confirmed: { color: COLORS.success, label: 'Confirmed', bg: '#0A1A12' },
    failed: { color: COLORS.danger, label: 'Failed', bg: '#1A0A0A' },
  }[status];

  return (
    <View style={[badge.wrap, { backgroundColor: config.bg, borderColor: config.color + '55' }]}>
      <Text style={[badge.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: { fontSize: 10, fontWeight: '700' },
});

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({ tx, prices }: { tx: TxRecord; prices: Record<string, number> }) {
  const fromCoin = COINS[tx.fromCoin];
  const toCoin = COINS[tx.toCoin];
  const isSwap = tx.type === 'swap';
  const fromUsd = toUsd(tx.fromAmount, prices[tx.fromCoin] ?? 0);
  const date = new Date(tx.timestamp);

  return (
    <TouchableOpacity
      style={rowStyles.card}
      onPress={() => tx.explorerUrl && Linking.openURL(tx.explorerUrl)}
      activeOpacity={0.7}
    >
      {/* Type icon */}
      <View style={[rowStyles.typeIcon, { backgroundColor: isSwap ? COLORS.primary + '22' : COLORS.secondary + '22' }]}>
        <Text style={rowStyles.typeEmoji}>{isSwap ? '⇄' : '↑'}</Text>
      </View>

      {/* Main info */}
      <View style={rowStyles.info}>
        <View style={rowStyles.topRow}>
          <Text style={rowStyles.description}>
            {isSwap
              ? `${tx.fromCoin.replace('_', ' ')} → ${tx.toCoin.replace('_', ' ')}`
              : `Send ${tx.fromCoin.replace('_', ' ')}`}
          </Text>
          <StatusBadge status={tx.status} />
        </View>

        <View style={rowStyles.amountRow}>
          <Text style={rowStyles.amount}>
            -{tx.fromAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tx.fromCoin.replace('_', ' ')}
          </Text>
          {isSwap && (
            <Text style={rowStyles.received}>
              +{tx.toAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tx.toCoin.replace('_', ' ')}
            </Text>
          )}
        </View>

        <View style={rowStyles.metaRow}>
          <Text style={rowStyles.meta}>
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {fromUsd > 0 && (
            <Text style={rowStyles.meta}>{formatUsd(fromUsd)}</Text>
          )}
          {tx.type === 'send' && tx.toAddress && (
            <Text style={rowStyles.meta} numberOfLines={1} ellipsizeMode="middle">
              To: {tx.toAddress.slice(0, 8)}…{tx.toAddress.slice(-6)}
            </Text>
          )}
        </View>

        {isSwap && tx.route && (
          <Text style={rowStyles.route}>via {tx.route}</Text>
        )}
      </View>

      <Text style={rowStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  typeEmoji: { fontSize: 18 },
  info: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  description: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' },
  amountRow: { flexDirection: 'row', gap: SPACING.md },
  amount: { color: COLORS.danger, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  received: { color: COLORS.success, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  meta: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  route: { color: COLORS.primary, fontSize: FONT_SIZE.xs },
  chevron: { color: COLORS.textMuted, fontSize: 18, alignSelf: 'center' },
});

// ─── Filter tabs ──────────────────────────────────────────────────────────────

function FilterTabs({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'swap', label: 'Swaps' },
    { key: 'send', label: 'Sends' },
  ];
  return (
    <View style={tabStyles.row}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[tabStyles.tab, active === t.key && tabStyles.active]}
          onPress={() => onChange(t.key)}
        >
          <Text style={[tabStyles.text, active === t.key && tabStyles.activeText]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  active: { backgroundColor: COLORS.primary },
  text: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  activeText: { color: COLORS.text },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { recentTxs, setRecentTxs, prices } = useAppStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTxHistory().then(setRecentTxs).catch(() => {});
    }, []),
  );

  async function handleRefresh() {
    setRefreshing(true);
    const history = await loadTxHistory().catch(() => []);
    setRecentTxs(history);
    setRefreshing(false);
  }

  const filtered = recentTxs.filter((tx) =>
    filter === 'all' ? true : tx.type === filter,
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>
            {recentTxs.length} transaction{recentTxs.length !== 1 ? 's' : ''} · Tap to view on explorer
          </Text>
        </View>

        {/* Filters */}
        <FilterTabs active={filter} onChange={setFilter} />

        {/* List */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>
              Your swaps and sends will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(tx) => tx.id}
            renderItem={({ item }) => <TxRow tx={item} prices={prices} />}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Note */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            ℹ️ Only transactions made in this app are shown. History is stored
            locally on this device. Tap any transaction to open it in a block
            explorer.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: SPACING.lg, gap: SPACING.md },
  header: { gap: SPACING.xs },
  title: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  list: { flex: 1 },
  listContent: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xxl,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '700' },
  emptySubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  note: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
  },
  noteText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
