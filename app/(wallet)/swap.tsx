/**
 * Swap Screen
 * -----------
 * Any-to-any in-wallet swap. Routes to Li.Fi (ETH/SOL) or THORChain (BTC).
 * Private keys never leave the device — signing happens locally at confirmation.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { getSwapQuote, type SwapQuote } from '../../src/services/swap/router';
import { executeSwap } from '../../src/services/swap/executor';
import type { SwapResult } from '../../src/services/swap/executor';
import { saveTxRecord } from '../../src/services/txHistory';
import { formatUsd, toUsd } from '../../src/services/prices';
import { COINS, COIN_LIST, type CoinSymbol } from '../../src/constants/coins';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';

// ─── Coin selector modal ──────────────────────────────────────────────────────

function CoinSelectorModal({
  visible,
  onSelect,
  onClose,
  exclude,
}: {
  visible: boolean;
  onSelect: (s: CoinSymbol) => void;
  onClose: () => void;
  exclude?: CoinSymbol;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>Select Coin</Text>
          <ScrollView>
            {COIN_LIST.filter((c) => c.symbol !== exclude).map((coin) => (
              <TouchableOpacity
                key={coin.symbol}
                style={modal.row}
                onPress={() => { onSelect(coin.symbol); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[modal.icon, { backgroundColor: coin.color + '22' }]}>
                  <Text style={[modal.iconText, { color: coin.color }]}>{coin.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modal.name}>{coin.name}</Text>
                  <Text style={modal.chain}>{coin.chain}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
            <Text style={modal.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgSecondary,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '75%',
    gap: SPACING.md,
  },
  title: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, fontWeight: '700' },
  name: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' },
  chain: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  closeBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  closeBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
});

// ─── Quote card ───────────────────────────────────────────────────────────────

function QuoteCard({ quote, prices }: { quote: SwapQuote; prices: Record<CoinSymbol, number> }) {
  const to = COINS[quote.toCoin];
  const toPrice = prices[quote.toCoin] ?? 0;
  const mins = Math.ceil(quote.estimatedTimeSecs / 60);
  const usdReceived = toUsd(quote.toAmount, toPrice);

  return (
    <View style={qs.card}>
      <Text style={qs.title}>Quote</Text>

      <View style={qs.highlight}>
        <Text style={qs.receiveLabel}>You receive</Text>
        <Text style={qs.receiveAmount}>
          {quote.toAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {to.symbol.replace('_', ' ')}
        </Text>
        {usdReceived > 0 && (
          <Text style={qs.receiveUsd}>≈ {formatUsd(usdReceived)}</Text>
        )}
      </View>

      {[
        { label: 'Route', value: quote.route },
        { label: 'Est. time', value: `~${mins} min` },
        {
          label: 'Price impact',
          value: `${quote.priceImpact.toFixed(2)}%`,
          danger: quote.priceImpact > 2,
        },
        ...quote.fees.map((f) => ({
          label: `${f.label} fee`,
          value: `${f.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${f.symbol}`,
          danger: false,
        })),
      ].map((row, i) => (
        <View key={i} style={qs.row}>
          <Text style={qs.rowLabel}>{row.label}</Text>
          <Text style={[qs.rowValue, row.danger && qs.dangerText]}>{row.value}</Text>
        </View>
      ))}

      <View style={qs.providerRow}>
        <Text style={qs.provider}>
          Powered by {quote.provider === 'lifi' ? 'Li.Fi' : 'THORChain'}
        </Text>
      </View>
    </View>
  );
}

const qs = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  title: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
  highlight: {
    backgroundColor: COLORS.bgTertiary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: 2,
  },
  receiveLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  receiveAmount: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '800' },
  receiveUsd: { color: COLORS.secondary, fontSize: FONT_SIZE.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  rowValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  dangerText: { color: COLORS.danger },
  providerRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  provider: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'right' },
});

// ─── Success card ─────────────────────────────────────────────────────────────

function SuccessCard({ result, onDismiss }: { result: SwapResult; onDismiss: () => void }) {
  return (
    <View style={success.card}>
      <Text style={success.icon}>✅</Text>
      <Text style={success.title}>Swap Submitted!</Text>
      <Text style={success.hash} numberOfLines={2} selectable>{result.txHash}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(result.explorerUrl)}>
        <Text style={success.explorerLink}>View on explorer →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={success.btn} onPress={onDismiss}>
        <Text style={success.btnText}>New Swap</Text>
      </TouchableOpacity>
    </View>
  );
}

const success = StyleSheet.create({
  card: {
    backgroundColor: '#0A1A12',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.success,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  icon: { fontSize: 48 },
  title: { color: COLORS.success, fontSize: FONT_SIZE.xl, fontWeight: '800' },
  hash: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontFamily: 'monospace', textAlign: 'center' },
  explorerLink: { color: COLORS.primary, fontSize: FONT_SIZE.sm, textDecorationLine: 'underline' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  btnText: { color: COLORS.text, fontWeight: '700' },
});

// ─── Main swap screen ─────────────────────────────────────────────────────────

export default function SwapScreen() {
  const { balances, prices, addresses, addTxRecord, slippagePct } = useAppStore();
  const [fromCoin, setFromCoin] = useState<CoinSymbol>('SOL');
  const [toCoin, setToCoin] = useState<CoinSymbol>('USDC_SOL');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [selectingFrom, setSelectingFrom] = useState(false);
  const [selectingTo, setSelectingTo] = useState(false);

  const fromConfig = COINS[fromCoin];
  const toConfig = COINS[toCoin];
  const fromBalance = balances[fromCoin];
  const fromPrice = prices[fromCoin];
  const amountUsd = amount ? toUsd(parseFloat(amount) || 0, fromPrice) : 0;

  function swapCoins() {
    setFromCoin(toCoin);
    setToCoin(fromCoin);
    setAmount('');
    setQuote(null);
  }

  async function handleGetQuote() {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid amount.');
      return;
    }
    if (num > fromBalance) {
      Alert.alert('Insufficient Balance', `You only have ${fromBalance} ${fromCoin}.`);
      return;
    }
    setQuoting(true);
    setQuote(null);
    try {
      const q = await getSwapQuote(fromCoin, toCoin, num, slippagePct);
      setQuote(q);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch quote';
      Alert.alert('Quote Failed', `${msg}\n\nCheck your connection and try again.`);
    } finally {
      setQuoting(false);
    }
  }

  async function handleConfirmSwap() {
    if (!quote) return;

    Alert.alert(
      '⚠️ Confirm Swap',
      `You are swapping:\n${quote.fromAmount} ${fromCoin}\n→ ~${quote.toAmount.toFixed(6)} ${toCoin}\n\nThis transaction is irreversible. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Swap',
          style: 'destructive',
          onPress: async () => {
            setSwapping(true);
            try {
              const btcAddr = fromCoin === 'BTC' ? addresses?.btc : undefined;
              const res = await executeSwap(quote, btcAddr);
              setResult(res);
              const record = {
                id: res.txHash,
                type: 'swap' as const,
                fromCoin,
                toCoin,
                fromAmount: quote.fromAmount,
                toAmount: quote.toAmount,
                txHash: res.txHash,
                status: res.status,
                explorerUrl: res.explorerUrl,
                timestamp: Date.now(),
                route: quote.route,
              };
              addTxRecord(record);
              await saveTxRecord(record);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Swap failed';
              Alert.alert('Swap Failed', msg);
            } finally {
              setSwapping(false);
            }
          },
        },
      ],
    );
  }

  function handleDismissResult() {
    setResult(null);
    setQuote(null);
    setAmount('');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Swap</Text>
        <Text style={styles.subtitle}>Any coin to any coin · 100% in-wallet</Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            🔐 Non-custodial. You sign locally. Routes via Li.Fi (EVM/Solana)
            and THORChain (BTC). Never leaves your device.
          </Text>
        </View>

        {/* From */}
        <View style={styles.swapCard}>
          <Text style={styles.swapLabel}>FROM</Text>
          <View style={styles.swapRow}>
            <TouchableOpacity
              style={[styles.coinPill, { borderColor: fromConfig.color + '66' }]}
              onPress={() => setSelectingFrom(true)}
            >
              <Text style={[styles.pillIcon, { color: fromConfig.color }]}>{fromConfig.icon}</Text>
              <Text style={styles.pillText}>{fromCoin.replace('_', ' ')}</Text>
              <Text style={styles.pillArrow}>▾</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              value={amount}
              onChangeText={(t) => { setAmount(t); setQuote(null); setResult(null); }}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceHint}>
              Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {fromCoin.replace('_', ' ')}
            </Text>
            {amountUsd > 0 && (
              <Text style={styles.usdHint}>≈ {formatUsd(amountUsd)}</Text>
            )}
          </View>
        </View>

        {/* Flip */}
        <TouchableOpacity style={styles.flipBtn} onPress={swapCoins} activeOpacity={0.7}>
          <Text style={styles.flipText}>⇅</Text>
        </TouchableOpacity>

        {/* To */}
        <View style={styles.swapCard}>
          <Text style={styles.swapLabel}>TO</Text>
          <View style={styles.swapRow}>
            <TouchableOpacity
              style={[styles.coinPill, { borderColor: toConfig.color + '66' }]}
              onPress={() => setSelectingTo(true)}
            >
              <Text style={[styles.pillIcon, { color: toConfig.color }]}>{toConfig.icon}</Text>
              <Text style={styles.pillText}>{toCoin.replace('_', ' ')}</Text>
              <Text style={styles.pillArrow}>▾</Text>
            </TouchableOpacity>
            <View style={styles.toAmountBox}>
              {quoting ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <Text style={styles.toAmount}>
                  {quote
                    ? `~${quote.toAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                    : '—'}
                </Text>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.slippageNote}>Slippage: {slippagePct}% · Adjust in Settings</Text>

        {/* Quote result */}
        {quote && !result ? (
          <QuoteCard quote={quote} prices={prices} />
        ) : null}

        {/* Success */}
        {result ? (
          <SuccessCard result={result} onDismiss={handleDismissResult} />
        ) : null}

        {/* Price impact warning */}
        {quote && quote.priceImpact > 2 && !result ? (
          <View style={styles.impactWarning}>
            <Text style={styles.impactWarningText}>
              ⚠️ High price impact ({quote.priceImpact.toFixed(2)}%). Consider
              splitting into smaller trades to reduce slippage.
            </Text>
          </View>
        ) : null}

        {/* Action */}
        {!result ? (
          !quote ? (
            <TouchableOpacity
              style={[styles.actionBtn, quoting && styles.btnDisabled]}
              onPress={handleGetQuote}
              disabled={quoting}
              activeOpacity={0.8}
            >
              {quoting ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.actionBtnText}>Get Best Quote</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnConfirm, swapping && styles.btnDisabled]}
              onPress={handleConfirmSwap}
              disabled={swapping}
              activeOpacity={0.8}
            >
              {swapping ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.actionBtnText}>
                  Confirm Swap →
                </Text>
              )}
            </TouchableOpacity>
          )
        ) : null}

        {quote && !result ? (
          <TouchableOpacity onPress={() => setQuote(null)}>
            <Text style={styles.resetText}>← Refresh quote</Text>
          </TouchableOpacity>
        ) : null}

        {/* Caution */}
        <View style={styles.caution}>
          <Text style={styles.cautionText}>
            ⚠️ Crypto swaps are irreversible. Verify amounts and routes before
            confirming. AllIn Wallet cannot recover swapped funds.
          </Text>
        </View>
      </ScrollView>

      <CoinSelectorModal
        visible={selectingFrom}
        onSelect={(s) => { setFromCoin(s); setQuote(null); setAmount(''); }}
        onClose={() => setSelectingFrom(false)}
        exclude={toCoin}
      />
      <CoinSelectorModal
        visible={selectingTo}
        onSelect={(s) => { setToCoin(s); setQuote(null); }}
        onClose={() => setSelectingTo(false)}
        exclude={fromCoin}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  notice: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  noticeText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
  swapCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  swapLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexShrink: 0,
  },
  pillIcon: { fontSize: 18, fontWeight: '700' },
  pillText: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
  pillArrow: { color: COLORS.textMuted, fontSize: 10 },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    textAlign: 'right',
    height: 44,
  },
  toAmountBox: { flex: 1, alignItems: 'flex-end' },
  toAmount: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xl, fontWeight: '700' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  usdHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  flipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  flipText: { color: COLORS.primary, fontSize: 22, fontWeight: '700' },
  slippageNote: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  impactWarning: {
    backgroundColor: '#1A0A0A',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  impactWarningText: { color: COLORS.warning, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  actionBtn: {
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnConfirm: { backgroundColor: COLORS.secondary },
  btnDisabled: { opacity: 0.5 },
  actionBtnText: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '800' },
  resetText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, textAlign: 'center', textDecorationLine: 'underline' },
  caution: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  cautionText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
