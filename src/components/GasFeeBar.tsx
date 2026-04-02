/**
 * GasFeeBar
 * ----------
 * Shows live network fee conditions for ETH (Gwei base fee) and BTC (sat/vbyte).
 * Color-coded: green = low, yellow = medium, red = high.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { fetchEthGasPrices } from '../services/fees';
import { fetchBtcFeeRates } from '../services/fees';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants/theme';

interface GasFeeData {
  ethGwei: number | null;
  btcSatVbyte: number | null;
  lastUpdated: number;
}

function feeColor(value: number, thresholds: [number, number]): string {
  if (value <= thresholds[0]) return COLORS.secondary; // green = low
  if (value <= thresholds[1]) return '#F5A623';         // yellow = medium
  return '#FF4D4D';                                      // red = high
}

export function GasFeeBar() {
  const [data, setData] = useState<GasFeeData>({
    ethGwei: null,
    btcSatVbyte: null,
    lastUpdated: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [ethGas, btcRates] = await Promise.allSettled([
        fetchEthGasPrices(),
        fetchBtcFeeRates(),
      ]);
      setData({
        ethGwei:
          ethGas.status === 'fulfilled'
            ? Math.round(Number(ethGas.value.standard) / 1e9)
            : null,
        btcSatVbyte:
          btcRates.status === 'fulfilled' ? btcRates.value.standard : null,
        lastUpdated: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000); // refresh every 60 s
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ethColor =
    data.ethGwei !== null ? feeColor(data.ethGwei, [20, 60]) : COLORS.textMuted;
  const btcColor =
    data.btcSatVbyte !== null
      ? feeColor(data.btcSatVbyte, [10, 30])
      : COLORS.textMuted;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={refresh}
      activeOpacity={0.7}
      accessibilityLabel="Network fee conditions. Tap to refresh."
    >
      <Text style={styles.title}>Network Fees</Text>

      <View style={styles.row}>
        {/* ETH */}
        <View style={styles.chip}>
          <View style={[styles.dot, { backgroundColor: ethColor }]} />
          <Text style={styles.label}>ETH</Text>
          <Text style={[styles.value, { color: ethColor }]}>
            {data.ethGwei !== null ? `${data.ethGwei} Gwei` : '—'}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* BTC */}
        <View style={styles.chip}>
          <View style={[styles.dot, { backgroundColor: btcColor }]} />
          <Text style={styles.label}>BTC</Text>
          <Text style={[styles.value, { color: btcColor }]}>
            {data.btcSatVbyte !== null ? `${data.btcSatVbyte} sat/vB` : '—'}
          </Text>
        </View>

        <Text style={styles.tapHint}>{loading ? '…' : '↻'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  title: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  value: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.border,
  },
  tapHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
});
