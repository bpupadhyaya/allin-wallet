/**
 * AllocationChart
 * ---------------
 * A horizontal stacked bar showing each coin's % share of total portfolio
 * USD value, with a colour-coded legend below.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppStore } from '../store/appStore';
import { toUsd, formatUsd } from '../services/prices';
import { COIN_LIST } from '../constants/coins';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../constants/theme';
import { useScaledTheme } from '../hooks/useScaledTheme';

interface Segment {
  symbol: string;
  name: string;
  color: string;
  icon: string;
  usd: number;
  pct: number;
}

export function AllocationChart() {
  const { balances, prices } = useAppStore();
  const { fontSize, navSize } = useScaledTheme();

  const { segments, total } = useMemo(() => {
    const all = COIN_LIST.map((coin) => ({
      symbol: coin.symbol,
      name: coin.name,
      color: coin.color,
      icon: coin.icon,
      usd: toUsd(balances[coin.symbol], prices[coin.symbol]),
    }));

    const total = all.reduce((s, c) => s + c.usd, 0);
    const segments: Segment[] = all
      .filter((c) => c.usd > 0)
      .sort((a, b) => b.usd - a.usd)
      .map((c) => ({ ...c, pct: total > 0 ? (c.usd / total) * 100 : 0 }));

    return { segments, total };
  }, [balances, prices]);

  if (total === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { fontSize: navSize.xs }]}>Allocation</Text>

      {/* Stacked bar */}
      <View style={styles.bar}>
        {segments.map((seg) => (
          <View
            key={seg.symbol}
            style={[
              styles.barSegment,
              {
                flex: seg.pct,
                backgroundColor: seg.color,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {segments.map((seg) => (
          <View key={seg.symbol} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <View style={styles.legendInfo}>
              <Text style={[styles.legendSymbol, { fontSize: fontSize.sm }]}>
                {seg.icon} {seg.symbol.replace('_', ' ')}
              </Text>
              <Text style={[styles.legendPct, { fontSize: fontSize.xs }]}>{seg.pct.toFixed(1)}%</Text>
            </View>
            <Text style={[styles.legendUsd, { fontSize: fontSize.sm }]}>{formatUsd(seg.usd)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    backgroundColor: COLORS.bgTertiary,
  },
  barSegment: { height: '100%' },
  legend: { gap: SPACING.sm },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  legendSymbol: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  legendPct: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  legendUsd: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
});
