/**
 * Swap Screen
 * -----------
 * Any-to-any in-wallet swap. Routes to Li.Fi (ETH/SOL) or THORChain (BTC).
 * Private keys never leave the device — only the signed transaction is broadcast.
 *
 * Current implementation covers the complete quote UI and provider routing.
 * Transaction signing is structured for each chain but requires the user's
 * mnemonic to be decrypted from secure storage — this is done only on
 * the final "Confirm & Swap" action.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { getSwapQuote, type SwapQuote } from '../../src/services/swap/router';
import { COINS, COIN_LIST, type CoinSymbol } from '../../src/constants/coins';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';

// ─── Coin selector modal ─────────────────────────────────────────────────────

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
  overlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'flex-end',
  },
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
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

// ─── Quote result card ───────────────────────────────────────────────────────

function QuoteCard({ quote }: { quote: SwapQuote }) {
  const from = COINS[quote.fromCoin];
  const to = COINS[quote.toCoin];
  const mins = Math.ceil(quote.estimatedTimeSecs / 60);

  return (
    <View style={quoteStyles.card}>
      <Text style={quoteStyles.title}>Quote</Text>
      <View style={quoteStyles.row}>
        <Text style={quoteStyles.label}>You receive</Text>
        <Text style={quoteStyles.value}>
          {quote.toAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {to.symbol}
        </Text>
      </View>
      <View style={quoteStyles.row}>
        <Text style={quoteStyles.label}>Route</Text>
        <Text style={quoteStyles.value}>{quote.route}</Text>
      </View>
      <View style={quoteStyles.row}>
        <Text style={quoteStyles.label}>Est. time</Text>
        <Text style={quoteStyles.value}>~{mins} min</Text>
      </View>
      <View style={quoteStyles.row}>
        <Text style={quoteStyles.label}>Price impact</Text>
        <Text style={[quoteStyles.value, quote.priceImpact > 2 && quoteStyles.danger]}>
          {quote.priceImpact.toFixed(2)}%
        </Text>
      </View>
      {quote.fees.map((fee, i) => (
        <View key={i} style={quoteStyles.row}>
          <Text style={quoteStyles.label}>{fee.label} fee</Text>
          <Text style={quoteStyles.value}>
            {fee.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {fee.symbol}
          </Text>
        </View>
      ))}
      <View style={quoteStyles.providerRow}>
        <Text style={quoteStyles.provider}>via {quote.provider === 'lifi' ? 'Li.Fi' : 'THORChain'}</Text>
      </View>
    </View>
  );
}

const quoteStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  title: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  value: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  danger: { color: COLORS.danger },
  providerRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  provider: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'right' },
});

// ─── Main swap screen ─────────────────────────────────────────────────────────

export default function SwapScreen() {
  const { balances } = useAppStore();
  const [fromCoin, setFromCoin] = useState<CoinSymbol>('SOL');
  const [toCoin, setToCoin] = useState<CoinSymbol>('USDC_SOL');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [selectingFrom, setSelectingFrom] = useState(false);
  const [selectingTo, setSelectingTo] = useState(false);

  const fromConfig = COINS[fromCoin];
  const toConfig = COINS[toCoin];
  const fromBalance = balances[fromCoin];

  function swapCoins() {
    setFromCoin(toCoin);
    setToCoin(fromCoin);
    setAmount('');
    setQuote(null);
  }

  async function handleGetQuote() {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to swap.');
      return;
    }
    if (num > fromBalance) {
      Alert.alert('Insufficient Balance', `You have ${fromBalance} ${fromCoin}.`);
      return;
    }
    setQuoting(true);
    setQuote(null);
    try {
      const q = await getSwapQuote(fromCoin, toCoin, num);
      setQuote(q);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to get quote';
      Alert.alert('Quote Failed', `${msg}\n\nCheck your network connection and try again.`);
    } finally {
      setQuoting(false);
    }
  }

  async function handleConfirmSwap() {
    if (!quote) return;

    Alert.alert(
      'Confirm Swap',
      `Swap ${quote.fromAmount} ${fromCoin} → ~${quote.toAmount.toFixed(6)} ${toCoin}\n\nThis action is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setSwapping(true);
            try {
              // TODO: implement tx signing and broadcast via signAndBroadcastSwap()
              // This requires getMnemonic() → derive signer → build tx from quote.rawData
              // See src/services/swap/executor.ts (to be implemented)
              Alert.alert(
                'Coming Soon',
                'Transaction signing is implemented in the next milestone. Quote and routing are fully functional.',
              );
            } finally {
              setSwapping(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Swap</Text>
        <Text style={styles.subtitle}>Any coin to any coin, fully in-wallet.</Text>

        {/* Security notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            🔐 All swaps are non-custodial. You sign transactions locally — your
            private key never leaves this device. Swaps are routed through Li.Fi
            (EVM/Solana) and THORChain (BTC).
          </Text>
        </View>

        {/* From */}
        <View style={styles.swapCard}>
          <Text style={styles.swapLabel}>From</Text>
          <View style={styles.swapRow}>
            <TouchableOpacity
              style={[styles.coinPill, { borderColor: fromConfig.color + '88' }]}
              onPress={() => setSelectingFrom(true)}
            >
              <Text style={[styles.coinPillIcon, { color: fromConfig.color }]}>
                {fromConfig.icon}
              </Text>
              <Text style={styles.coinPillText}>{fromConfig.symbol}</Text>
              <Text style={styles.coinPillArrow}>▾</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              value={amount}
              onChangeText={(t) => { setAmount(t); setQuote(null); }}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.balanceHint}>
            Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {fromCoin}
          </Text>
        </View>

        {/* Swap direction toggle */}
        <TouchableOpacity style={styles.swapToggle} onPress={swapCoins} activeOpacity={0.7}>
          <Text style={styles.swapToggleText}>⇅</Text>
        </TouchableOpacity>

        {/* To */}
        <View style={styles.swapCard}>
          <Text style={styles.swapLabel}>To</Text>
          <View style={styles.swapRow}>
            <TouchableOpacity
              style={[styles.coinPill, { borderColor: toConfig.color + '88' }]}
              onPress={() => setSelectingTo(true)}
            >
              <Text style={[styles.coinPillIcon, { color: toConfig.color }]}>
                {toConfig.icon}
              </Text>
              <Text style={styles.coinPillText}>{toConfig.symbol}</Text>
              <Text style={styles.coinPillArrow}>▾</Text>
            </TouchableOpacity>
            <View style={styles.toAmountBox}>
              <Text style={styles.toAmountText}>
                {quote
                  ? `~${quote.toAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Slippage note */}
        <Text style={styles.slippageNote}>
          Default slippage: 0.5% · Adjust in Settings
        </Text>

        {/* Quote */}
        {quoting ? (
          <View style={styles.quotingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.quotingText}>Fetching best route…</Text>
          </View>
        ) : null}

        {quote ? <QuoteCard quote={quote} /> : null}

        {/* Action buttons */}
        {!quote ? (
          <TouchableOpacity
            style={[styles.actionBtn, quoting && styles.actionBtnDisabled]}
            onPress={handleGetQuote}
            disabled={quoting}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>Get Quote</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSwap, swapping && styles.actionBtnDisabled]}
            onPress={handleConfirmSwap}
            disabled={swapping}
            activeOpacity={0.8}
          >
            {swapping ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.actionBtnText}>
                Swap {fromCoin} → {toCoin}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {quote ? (
          <TouchableOpacity onPress={() => setQuote(null)}>
            <Text style={styles.resetText}>Get new quote</Text>
          </TouchableOpacity>
        ) : null}

        {/* Warning */}
        <View style={styles.caution}>
          <Text style={styles.cautionText}>
            ⚠️ Crypto swaps are irreversible. Verify the amounts and route
            carefully before confirming. High price impact (&gt;2%) may indicate
            low liquidity.
          </Text>
        </View>
      </ScrollView>

      {/* Coin selector modals */}
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
  scroll: {
    flexGrow: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
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
  swapLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', letterSpacing: 1 },
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
  },
  coinPillIcon: { fontSize: 18, fontWeight: '700' },
  coinPillText: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
  coinPillArrow: { color: COLORS.textMuted, fontSize: 10 },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    textAlign: 'right',
    height: 44,
  },
  toAmountBox: { flex: 1, alignItems: 'flex-end' },
  toAmountText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xl, fontWeight: '700' },
  balanceHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  swapToggle: {
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
  swapToggleText: { color: COLORS.primary, fontSize: 22, fontWeight: '700' },
  slippageNote: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  quotingRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  actionBtn: {
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSwap: { backgroundColor: COLORS.secondary },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  resetText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  caution: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  cautionText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
