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
import { saveTxRecord, updateTxRecord } from '../../src/services/txHistory';
import { formatUsd, toUsd } from '../../src/services/prices';
import { COINS, COIN_LIST, type CoinSymbol } from '../../src/constants/coins';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../src/constants/theme';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';

// ─── Slippage options ─────────────────────────────────────────────────────────

const SLIPPAGE_PRESETS = [0.5, 1.0, 2.0];

function SlippageSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { fontSize } = useScaledTheme();
  return (
    <View style={slipStyles.row}>
      <Text style={[slipStyles.label, { fontSize: fontSize.sm }]}>Slippage</Text>
      <View style={slipStyles.pills}>
        {SLIPPAGE_PRESETS.map((pct) => (
          <TouchableOpacity
            key={pct}
            style={[slipStyles.pill, value === pct && slipStyles.pillActive]}
            onPress={() => onChange(pct)}
            activeOpacity={0.7}
          >
            <Text style={[slipStyles.pillText, value === pct && slipStyles.pillTextActive, { fontSize: fontSize.sm }]}>
              {pct}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const slipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  pills: { flexDirection: 'row', gap: SPACING.xs },
  pill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.bgTertiary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  pillTextActive: { color: COLORS.text },
});

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
  const { fontSize, scaleFont, uiScale } = useScaledTheme();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={[modal.title, { fontSize: fontSize.lg }]}>Select Coin</Text>
          <ScrollView>
            {COIN_LIST.filter((c) => c.symbol !== exclude).map((coin) => (
              <TouchableOpacity
                key={coin.symbol}
                style={modal.row}
                onPress={() => { onSelect(coin.symbol); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[modal.icon, { backgroundColor: coin.color + '22', width: 40 * uiScale, height: 40 * uiScale, borderRadius: 20 * uiScale }]}>
                  <Text style={[modal.iconText, { color: coin.color, fontSize: scaleFont(20) }]}>{coin.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[modal.name, { fontSize: fontSize.md }]}>{coin.name}</Text>
                  <Text style={[modal.chain, { fontSize: fontSize.xs }]}>{coin.chain}</Text>
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
  title: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.heavy, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, fontWeight: FONT_WEIGHT.heavy },
  name: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  chain: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  closeBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  closeBtnText: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.bold },
});

// ─── Quote card ───────────────────────────────────────────────────────────────

function QuoteCard({ quote, prices }: { quote: SwapQuote; prices: Record<CoinSymbol, number> }) {
  const { fontSize, contentSize } = useScaledTheme();
  const to = COINS[quote.toCoin];
  const toPrice = prices[quote.toCoin] ?? 0;
  const mins = Math.ceil(quote.estimatedTimeSecs / 60);
  const usdReceived = toUsd(quote.toAmount, toPrice);

  return (
    <View style={qs.card}>
      <Text style={[qs.title, { fontSize: fontSize.md }]}>Quote</Text>

      <View style={qs.highlight}>
        <Text style={[qs.receiveLabel, { fontSize: fontSize.xs }]}>You receive</Text>
        <Text style={[qs.receiveAmount, { fontSize: fontSize.xl }]}>
          {quote.toAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {to.symbol.replace('_', ' ')}
        </Text>
        {usdReceived > 0 && (
          <Text style={[qs.receiveUsd, { fontSize: fontSize.sm }]}>≈ {formatUsd(usdReceived)}</Text>
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
          <Text style={[qs.rowLabel, { fontSize: contentSize.sm }]}>{row.label}</Text>
          <Text style={[qs.rowValue, row.danger && qs.dangerText, { fontSize: contentSize.sm }]}>{row.value}</Text>
        </View>
      ))}

      <View style={qs.providerRow}>
        <Text style={[qs.provider, { fontSize: contentSize.xs }]}>
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
  title: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.heavy },
  highlight: {
    backgroundColor: COLORS.bgTertiary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: 2,
  },
  receiveLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  receiveAmount: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.heavy },
  receiveUsd: { color: COLORS.secondary, fontSize: FONT_SIZE.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  rowValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  dangerText: { color: COLORS.danger },
  providerRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  provider: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'right' },
});

// ─── Success card ─────────────────────────────────────────────────────────────

function SuccessCard({
  result,
  toCoin,
  onDismiss,
}: {
  result: SwapResult;
  toCoin: CoinSymbol;
  onDismiss: () => void;
}) {
  const { fontSize, contentSize, scaleFont } = useScaledTheme();
  const isPending = result.status === 'pending';
  const isEth = COINS[toCoin]?.chain === 'ethereum' || result.explorerUrl.includes('etherscan');
  const isDevMock = result.txHash.startsWith('dev_');

  return (
    <View style={success.card}>
      <Text style={[success.icon, { fontSize: scaleFont(48) }]}>✅</Text>
      <Text style={[success.title, { fontSize: fontSize.xl }]}>{isDevMock ? 'Swap Simulated!' : 'Swap Submitted!'}</Text>
      {isDevMock && (
        <Text style={[success.pendingNote, { fontSize: contentSize.xs }]}>
          🛠 Dev mode — this is a simulated transaction. No real funds were moved.
        </Text>
      )}
      {isPending && isEth && !isDevMock && (
        <Text style={[success.pendingNote, { fontSize: contentSize.xs }]}>
          ⏳ ETH transaction is confirming on-chain. Status will update automatically.
        </Text>
      )}
      <Text style={[success.hash, { fontSize: fontSize.xs }]} numberOfLines={2} selectable>{result.txHash}</Text>
      {!isDevMock && (
        <TouchableOpacity onPress={() => Linking.openURL(result.explorerUrl)}>
          <Text style={[success.explorerLink, { fontSize: fontSize.sm }]}>View on explorer →</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={success.btn} onPress={onDismiss}>
        <Text style={[success.btnText, { fontSize: fontSize.md }]}>New Swap</Text>
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
  title: { color: COLORS.success, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.heavy },
  pendingNote: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  hash: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontFamily: 'monospace', textAlign: 'center' },
  explorerLink: { color: COLORS.primary, fontSize: FONT_SIZE.sm, textDecorationLine: 'underline' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  btnText: { color: COLORS.text, fontWeight: FONT_WEIGHT.heavy },
});

// ─── Main swap screen ─────────────────────────────────────────────────────────

export default function SwapScreen() {
  const {
    balances, prices, addresses, addTxRecord, slippagePct, setSlippage,
    updateTxStatus, setBalances,
  } = useAppStore();
  const { fontSize, contentSize, navSize, scaleFont, uiScale } = useScaledTheme();
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

  /** Resolve the user's receiving address for the destination chain. */
  function destinationAddress(): string | undefined {
    const chain = COINS[toCoin].chain;
    if (chain === 'bitcoin') return addresses?.btc;
    if (chain === 'ethereum') return addresses?.eth;
    if (chain === 'solana') return addresses?.sol;
    return undefined;
  }

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

    const destAddr = destinationAddress();
    const needsDest = fromConfig.chain === 'bitcoin' || toConfig.chain === 'bitcoin';
    if (needsDest && !destAddr) {
      Alert.alert(
        'Address Unavailable',
        'Your destination wallet address could not be found. ' +
        'Please restart the app and try again.',
      );
      return;
    }

    setQuoting(true);
    setQuote(null);
    try {
      const q = await getSwapQuote(fromCoin, toCoin, num, slippagePct, destAddr);
      setQuote(q);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch quote';
      const isNetworkErr =
        msg.includes('Network Error') || msg.includes('timeout');
      Alert.alert(
        'Quote Failed',
        isNetworkErr ? `${msg}\n\nCheck your connection and try again.` : msg,
      );
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

              const res = await executeSwap(
                quote,
                btcAddr,
                // Background callback for ETH tx confirmation
                async (txHash, status) => {
                  updateTxStatus(txHash, status);
                  await updateTxRecord(txHash, { status });
                },
              );

              setResult(res);

              // Dev mock: adjust balances to reflect the simulated swap
              if (res.txHash.startsWith('dev_')) {
                const updated = { ...balances };
                updated[fromCoin] = Math.max(0, updated[fromCoin] - quote.fromAmount);
                updated[toCoin] = updated[toCoin] + quote.toAmount;
                setBalances(updated);
              }

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
        <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Swap</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>Any coin to any coin · 100% in-wallet</Text>

        <View style={styles.notice}>
          <Text style={[styles.noticeText, { fontSize: contentSize.xs }]}>
            🔐 Non-custodial. You sign locally. Routes via Li.Fi (EVM/Solana)
            and THORChain (BTC). Never leaves your device.
          </Text>
        </View>

        {/* Slippage selector */}
        <SlippageSelector value={slippagePct} onChange={setSlippage} />

        {/* From */}
        <View style={styles.swapCard}>
          <Text style={[styles.swapLabel, { fontSize: navSize.xs }]}>FROM</Text>
          <View style={styles.swapRow}>
            <TouchableOpacity
              style={[styles.coinPill, { borderColor: fromConfig.color + '66' }]}
              onPress={() => setSelectingFrom(true)}
            >
              <Text style={[styles.pillIcon, { color: fromConfig.color, fontSize: scaleFont(18) }]}>{fromConfig.icon}</Text>
              <Text style={[styles.pillText, { fontSize: fontSize.md }]}>{fromCoin.replace('_', ' ')}</Text>
              <Text style={[styles.pillArrow, { fontSize: scaleFont(10) }]}>▾</Text>
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
            <Text style={[styles.balanceHint, { fontSize: fontSize.xs }]}>
              Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {fromCoin.replace('_', ' ')}
            </Text>
            {amountUsd > 0 && (
              <Text style={[styles.usdHint, { fontSize: fontSize.xs }]}>≈ {formatUsd(amountUsd)}</Text>
            )}
          </View>
        </View>

        {/* Flip */}
        <TouchableOpacity style={[styles.flipBtn, { width: 44 * uiScale, height: 44 * uiScale, borderRadius: 22 * uiScale }]} onPress={swapCoins} activeOpacity={0.7}>
          <Text style={[styles.flipText, { fontSize: scaleFont(22) }]}>⇅</Text>
        </TouchableOpacity>

        {/* To */}
        <View style={styles.swapCard}>
          <Text style={[styles.swapLabel, { fontSize: navSize.xs }]}>TO</Text>
          <View style={styles.swapRow}>
            <TouchableOpacity
              style={[styles.coinPill, { borderColor: toConfig.color + '66' }]}
              onPress={() => setSelectingTo(true)}
            >
              <Text style={[styles.pillIcon, { color: toConfig.color, fontSize: scaleFont(18) }]}>{toConfig.icon}</Text>
              <Text style={[styles.pillText, { fontSize: fontSize.md }]}>{toCoin.replace('_', ' ')}</Text>
              <Text style={[styles.pillArrow, { fontSize: scaleFont(10) }]}>▾</Text>
            </TouchableOpacity>
            <View style={styles.toAmountBox}>
              {quoting ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <Text style={[styles.toAmount, { fontSize: fontSize.xl }]}>
                  {quote
                    ? `~${quote.toAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                    : '—'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Quote result */}
        {quote && !result ? (
          <QuoteCard quote={quote} prices={prices} />
        ) : null}

        {/* Success */}
        {result ? (
          <SuccessCard result={result} toCoin={toCoin} onDismiss={handleDismissResult} />
        ) : null}

        {/* Price impact warning */}
        {quote && quote.priceImpact > 2 && !result ? (
          <View style={styles.impactWarning}>
            <Text style={[styles.impactWarningText, { fontSize: contentSize.sm }]}>
              ⚠️ High price impact ({quote.priceImpact.toFixed(2)}%). Consider
              splitting into smaller trades to reduce slippage.
            </Text>
          </View>
        ) : null}

        {/* Action */}
        {!result ? (
          !quote ? (
            <TouchableOpacity
              style={[styles.actionBtn, quoting && styles.btnDisabled, { height: 56 * uiScale }]}
              onPress={handleGetQuote}
              disabled={quoting}
              activeOpacity={0.8}
            >
              {quoting ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={[styles.actionBtnText, { fontSize: fontSize.lg }]}>Get Best Quote</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnConfirm, swapping && styles.btnDisabled, { height: 56 * uiScale }]}
              onPress={handleConfirmSwap}
              disabled={swapping}
              activeOpacity={0.8}
            >
              {swapping ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={[styles.actionBtnText, { fontSize: fontSize.lg }]}>
                  Confirm Swap →
                </Text>
              )}
            </TouchableOpacity>
          )
        ) : null}

        {quote && !result ? (
          <TouchableOpacity onPress={() => setQuote(null)}>
            <Text style={[styles.resetText, { fontSize: fontSize.sm }]}>← Refresh quote</Text>
          </TouchableOpacity>
        ) : null}

        {/* Caution */}
        <View style={styles.caution}>
          <Text style={[styles.cautionText, { fontSize: contentSize.xs }]}>
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
  title: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: FONT_WEIGHT.heavy },
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
    fontWeight: FONT_WEIGHT.heavy,
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
  pillIcon: { fontSize: 18, fontWeight: FONT_WEIGHT.heavy },
  pillText: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.heavy },
  pillArrow: { color: COLORS.textMuted, fontSize: 10 },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.heavy,
    textAlign: 'right',
    height: 44,
  },
  toAmountBox: { flex: 1, alignItems: 'flex-end' },
  toAmount: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.heavy },
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
  flipText: { color: COLORS.primary, fontSize: 22, fontWeight: FONT_WEIGHT.heavy },
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
  actionBtnText: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.heavy },
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
