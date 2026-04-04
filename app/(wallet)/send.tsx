/**
 * Send Screen
 * -----------
 * Supports sending all 7 coins — including native BTC with UTXO management
 * and configurable fee rates (slow / standard / fast).
 *
 * ETH / ERC-20: ethers v6
 * SOL / SPL:    @solana/web3.js + @solana/spl-token
 * BTC:          @scure/btc-signer via btcSend service
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ethers } from 'ethers';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useAppStore } from '../../src/store/appStore';
import { getMnemonic } from '../../src/services/storage';
import { getEthSigner, getSolKeypair } from '../../src/crypto/wallets';
import { sendBtc, fetchBtcUtxos } from '../../src/services/btcSend';
import {
  fetchBtcFeeRates,
  btcFeeEstimate,
  fetchEthGasPrices,
  ethFeeEstimate,
  SOL_TX_FEE,
  type BtcFeeRates,
} from '../../src/services/fees';
import { saveTxRecord, updateTxRecord } from '../../src/services/txHistory';
import { formatUsd, toUsd } from '../../src/services/prices';
import { COINS, COIN_LIST, type CoinSymbol } from '../../src/constants/coins';
import { getRpc, getExplorerTxUrl } from '../../src/constants/config';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, FONT_WEIGHT } from '../../src/constants/theme';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';

const ALL_SENDABLE: CoinSymbol[] = [
  'BTC', 'ETH', 'SOL', 'USDC_ETH', 'USDT_ETH', 'USDC_SOL', 'USDT_SOL',
];

type FeeSpeed = 'slow' | 'standard' | 'fast';

// ─── Coin picker modal ────────────────────────────────────────────────────────

function CoinPickerModal({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (s: CoinSymbol) => void;
  onClose: () => void;
}) {
  const { fontSize, scaleFont, uiScale } = useScaledTheme();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={[m.title, { fontSize: fontSize.lg }]}>Select Asset</Text>
          <ScrollView>
            {COIN_LIST.filter((c) => ALL_SENDABLE.includes(c.symbol)).map((coin) => (
              <TouchableOpacity
                key={coin.symbol}
                style={m.row}
                onPress={() => { onSelect(coin.symbol); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[m.icon, { backgroundColor: coin.color + '22', width: 40 * uiScale, height: 40 * uiScale, borderRadius: 20 * uiScale }]}>
                  <Text style={[m.iconText, { color: coin.color, fontSize: scaleFont(20) }]}>{coin.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[m.name, { fontSize: fontSize.md }]}>{coin.name}</Text>
                  <Text style={[m.chain, { fontSize: fontSize.xs }]}>{coin.chain}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={m.closeBtn} onPress={onClose}>
            <Text style={m.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgSecondary,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '70%',
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

// ─── Fee speed row ────────────────────────────────────────────────────────────

function FeeSpeedRow({
  selected,
  onSelect,
  rates,
  numInputs,
}: {
  selected: FeeSpeed;
  onSelect: (s: FeeSpeed) => void;
  rates: BtcFeeRates;
  numInputs: number;
}) {
  const { fontSize, scaleFont } = useScaledTheme();
  const options: { key: FeeSpeed; label: string; icon: string; rate: number }[] = [
    { key: 'slow', label: '~1 hr', icon: '🐢', rate: rates.slow },
    { key: 'standard', label: '~30 min', icon: '⚡', rate: rates.standard },
    { key: 'fast', label: '~10 min', icon: '🚀', rate: rates.fast },
  ];

  return (
    <View style={feeStyles.row}>
      {options.map((opt) => {
        const feeBtc = btcFeeEstimate(opt.rate, numInputs);
        const active = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[feeStyles.card, active && feeStyles.cardActive]}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={[feeStyles.cardIcon, { fontSize: scaleFont(18) }]}>{opt.icon}</Text>
            <Text style={[feeStyles.cardLabel, active && feeStyles.cardLabelActive, { fontSize: fontSize.xs }]}>
              {opt.label}
            </Text>
            <Text style={[feeStyles.cardRate, { fontSize: scaleFont(10) }]}>{opt.rate} sat/vB</Text>
            <Text style={[feeStyles.cardFee, { fontSize: scaleFont(10) }]}>{feeBtc.toFixed(8)} BTC</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const feeStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.sm },
  card: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
    gap: 2,
  },
  cardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.bgTertiary },
  cardIcon: { fontSize: 18 },
  cardLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  cardLabelActive: { color: COLORS.primary },
  cardRate: { color: COLORS.textMuted, fontSize: 10 },
  cardFee: { color: COLORS.text, fontSize: 10, fontWeight: FONT_WEIGHT.bold },
});

// ─── Main send screen ─────────────────────────────────────────────────────────

export default function SendScreen() {
  const { balances, prices, addresses, addTxRecord, updateTxStatus } = useAppStore();
  const { fontSize, contentSize, navSize, scaleFont, uiScale } = useScaledTheme();
  const [coin, setCoin] = useState<CoinSymbol>('SOL');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [explorerUrl, setExplorerUrl] = useState('');

  // Fee state
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed>('standard');
  const [btcFeeRates, setBtcFeeRates] = useState<BtcFeeRates | null>(null);
  const [btcUtxoCount, setBtcUtxoCount] = useState(1);
  const [ethFeeEth, setEthFeeEth] = useState<number | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);

  const coinConfig = COINS[coin];
  const balance = balances[coin];
  const price = prices[coin];
  const amountNum = parseFloat(amount) || 0;
  const usdValue = toUsd(amountNum, price);

  // Load fee data when coin changes
  useEffect(() => {
    async function loadFees() {
      setLoadingFees(true);
      try {
        if (coinConfig.chain === 'bitcoin') {
          const [rates, utxos] = await Promise.all([
            fetchBtcFeeRates(),
            addresses?.btc ? fetchBtcUtxos(addresses.btc) : Promise.resolve([]),
          ]);
          setBtcFeeRates(rates);
          setBtcUtxoCount(Math.max(utxos.length, 1));
        } else if (coinConfig.chain === 'ethereum') {
          const gas = await fetchEthGasPrices();
          const isERC20 = !coinConfig.isNative;
          setEthFeeEth(ethFeeEstimate(gas.standard, isERC20));
        }
      } catch {
        // Fees not critical — user can still proceed
      } finally {
        setLoadingFees(false);
      }
    }
    loadFees();
  }, [coin]);

  function validateAddress(addr: string): boolean {
    if (!addr.trim()) { setAddressError('Recipient address required'); return false; }
    if (coinConfig.chain === 'ethereum' && !ethers.isAddress(addr)) {
      setAddressError('Invalid Ethereum address');
      return false;
    }
    if (coinConfig.chain === 'solana') {
      try { new PublicKey(addr); } catch {
        setAddressError('Invalid Solana address');
        return false;
      }
    }
    if (coinConfig.chain === 'bitcoin' && !addr.startsWith('bc1') && !addr.startsWith('1') && !addr.startsWith('3')) {
      setAddressError('Invalid Bitcoin address');
      return false;
    }
    setAddressError('');
    return true;
  }

  function validateAmount(val: string): boolean {
    const num = parseFloat(val);
    if (!val || isNaN(num) || num <= 0) { setAmountError('Enter a valid amount'); return false; }
    if (num > balance) {
      setAmountError(
        `Insufficient balance (${balance.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${coin})`,
      );
      return false;
    }
    setAmountError('');
    return true;
  }

  function currentFeeRate(): number {
    if (!btcFeeRates) return 10;
    return btcFeeRates[feeSpeed];
  }

  async function doSend() {
    setSending(true);
    try {
      const mnemonic = await getMnemonic();
      if (!mnemonic) throw new Error('Wallet locked — please log in again.');

      let hash: string;
      let explorer: string;
      const chain = coinConfig.chain;

      if (chain === 'bitcoin') {
        if (!addresses?.btc) throw new Error('No BTC address found.');
        const result = await sendBtc({
          toAddress: toAddress.trim(),
          amountBtc: amountNum,
          feeRateSatVbyte: currentFeeRate(),
          senderAddress: addresses.btc,
        });
        hash = result.txHash;
        explorer = result.explorerUrl;
      } else if (chain === 'ethereum') {
        const signer = await getEthSigner(mnemonic, getRpc().ETHEREUM);
        if (coin === 'ETH') {
          const tx = await signer.sendTransaction({
            to: toAddress.trim(),
            value: ethers.parseEther(amount),
          });
          hash = tx.hash;
        } else {
          const erc20 = new ethers.Contract(
            coinConfig.contractAddress!,
            ['function transfer(address,uint256) returns (bool)'],
            signer,
          );
          const tx = await erc20.transfer(
            toAddress.trim(),
            BigInt(Math.floor(amountNum * 10 ** coinConfig.decimals)),
          );
          hash = tx.hash;
        }
        explorer = getExplorerTxUrl('ethereum', hash);

        // Background confirmation polling — ETH blocks take ~12 s each
        const ethHash = hash;
        signer.provider!
          .waitForTransaction(ethHash, 1, 10 * 60 * 1000)
          .then(() => {
            updateTxStatus(ethHash, 'confirmed');
            updateTxRecord(ethHash, { status: 'confirmed' }).catch(() => {});
          })
          .catch(() => {
            updateTxStatus(ethHash, 'failed');
            updateTxRecord(ethHash, { status: 'failed' }).catch(() => {});
          });
      } else {
        // Solana
        const keypair = await getSolKeypair(mnemonic);
        const connection = new Connection(getRpc().SOLANA, 'confirmed');
        const toPubkey = new PublicKey(toAddress.trim());

        if (coin === 'SOL') {
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey,
              lamports: Math.floor(amountNum * LAMPORTS_PER_SOL),
            }),
          );
          hash = await connection.sendTransaction(tx, [keypair]);
        } else {
          const mint = new PublicKey(coinConfig.contractAddress!);
          const fromAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
          const toAta = await getAssociatedTokenAddress(mint, toPubkey);
          const tx = new Transaction().add(
            createTransferInstruction(
              fromAta,
              toAta,
              keypair.publicKey,
              BigInt(Math.floor(amountNum * 10 ** coinConfig.decimals)),
              [],
              TOKEN_PROGRAM_ID,
            ),
          );
          hash = await connection.sendTransaction(tx, [keypair]);
        }
        explorer = getExplorerTxUrl('solana', hash);
      }

      // Persist tx record
      const record = {
        id: hash,
        type: 'send' as const,
        fromCoin: coin,
        toCoin: coin,
        fromAmount: amountNum,
        toAmount: amountNum,
        toAddress: toAddress.trim(),
        txHash: hash,
        status: 'pending' as const,
        explorerUrl: explorer,
        timestamp: Date.now(),
      };
      addTxRecord(record);
      await saveTxRecord(record);

      setTxHash(hash);
      setExplorerUrl(explorer);
      setAmount('');
      setToAddress('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      Alert.alert('Send Failed', msg);
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!validateAddress(toAddress) || !validateAmount(amount)) return;

    Alert.alert(
      'Confirm Send',
      `Send ${amount} ${coin}\nTo: ${toAddress.slice(0, 10)}…${toAddress.slice(-8)}\n\nThis is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'destructive', onPress: doSend },
      ],
    );
  }

  // ── Success view ──────────────────────────────────────────────────────────
  if (txHash) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successScreen}>
          <Text style={[styles.successIcon, { fontSize: scaleFont(64) }]}>✅</Text>
          <Text style={[styles.successTitle, { fontSize: fontSize.xxl }]}>Sent!</Text>
          <Text style={[styles.successHash, { fontSize: fontSize.sm }]} selectable numberOfLines={2}>{txHash}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(explorerUrl)}>
            <Text style={[styles.explorerLink, { fontSize: fontSize.sm }]}>View on explorer →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => { setTxHash(''); setExplorerUrl(''); }}
          >
            <Text style={[styles.doneBtnText, { fontSize: fontSize.md }]}>Send Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { fontSize: fontSize.xxl }]}>Send</Text>
        <Text style={[styles.subtitle, { fontSize: contentSize.sm }]}>Signed locally · Broadcast directly</Text>

        <View style={styles.notice}>
          <Text style={[styles.noticeText, { fontSize: contentSize.xs }]}>
            🔐 Private key never leaves this device. Verify the recipient
            address carefully — crypto transfers are irreversible.
          </Text>
        </View>

        {/* Asset */}
        <View style={styles.field}>
          <Text style={[styles.label, { fontSize: fontSize.sm }]}>Asset</Text>
          <TouchableOpacity
            style={styles.coinSelector}
            onPress={() => setPicking(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.coinIcon, { backgroundColor: coinConfig.color + '22', width: 36 * uiScale, height: 36 * uiScale, borderRadius: 18 * uiScale }]}>
              <Text style={[styles.coinIconText, { color: coinConfig.color, fontSize: scaleFont(18) }]}>
                {coinConfig.icon}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.coinName, { fontSize: fontSize.md }]}>{coinConfig.name}</Text>
              <Text style={[styles.coinBalance, { fontSize: fontSize.xs }]}>
                Balance: {balance.toLocaleString(undefined, { maximumFractionDigits: 8 })} {coin.replace('_', ' ')}
              </Text>
            </View>
            <Text style={styles.chevron}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* Recipient */}
        <View style={styles.field}>
          <Text style={[styles.label, { fontSize: fontSize.sm }]}>Recipient Address</Text>
          <TextInput
            style={[styles.input, addressError ? styles.inputError : null]}
            placeholder={
              coinConfig.chain === 'ethereum' ? '0x...'
                : coinConfig.chain === 'solana' ? 'Solana base58 address'
                  : 'bc1... (Native SegWit)'
            }
            placeholderTextColor={COLORS.textMuted}
            value={toAddress}
            onChangeText={(t) => { setToAddress(t); setAddressError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {addressError ? <Text style={[styles.fieldError, { fontSize: fontSize.xs }]}>{addressError}</Text> : null}
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { fontSize: fontSize.sm }]}>Amount</Text>
            <TouchableOpacity onPress={() => setAmount(balance.toString())}>
              <Text style={[styles.maxBtn, { fontSize: fontSize.xs }]}>MAX</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, amountError ? styles.inputError : null]}
            placeholder={`0.00 ${coin.replace('_', ' ')}`}
            placeholderTextColor={COLORS.textMuted}
            value={amount}
            onChangeText={(t) => { setAmount(t); setAmountError(''); }}
            keyboardType="decimal-pad"
          />
          {amountError ? (
            <Text style={[styles.fieldError, { fontSize: fontSize.xs }]}>{amountError}</Text>
          ) : amount ? (
            <Text style={[styles.usdHint, { fontSize: fontSize.xs }]}>≈ {formatUsd(usdValue)}</Text>
          ) : null}
        </View>

        {/* BTC fee selector */}
        {coinConfig.chain === 'bitcoin' && (
          <View style={styles.field}>
            <Text style={[styles.label, { fontSize: fontSize.sm }]}>Network Fee</Text>
            {loadingFees ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : btcFeeRates ? (
              <FeeSpeedRow
                selected={feeSpeed}
                onSelect={setFeeSpeed}
                rates={btcFeeRates}
                numInputs={btcUtxoCount}
              />
            ) : (
              <Text style={[styles.feeNote, { fontSize: contentSize.xs }]}>Could not load fee rates. Default 10 sat/vbyte.</Text>
            )}
          </View>
        )}

        {/* ETH fee estimate */}
        {coinConfig.chain === 'ethereum' && ethFeeEth !== null && (
          <View style={styles.feeEstimate}>
            <Text style={[styles.feeEstimateLabel, { fontSize: fontSize.sm }]}>Estimated fee</Text>
            <Text style={[styles.feeEstimateValue, { fontSize: fontSize.sm }]}>
              ~{ethFeeEth.toFixed(6)} ETH
              {prices.ETH > 0 ? ` (${formatUsd(toUsd(ethFeeEth, prices.ETH))})` : ''}
            </Text>
          </View>
        )}

        {/* SOL fee estimate */}
        {coinConfig.chain === 'solana' && (
          <View style={styles.feeEstimate}>
            <Text style={[styles.feeEstimateLabel, { fontSize: fontSize.sm }]}>Estimated fee</Text>
            <Text style={[styles.feeEstimateValue, { fontSize: fontSize.sm }]}>~{SOL_TX_FEE} SOL (negligible)</Text>
          </View>
        )}

        {/* Warning */}
        <View style={styles.warning}>
          <Text style={[styles.warningText, { fontSize: contentSize.sm }]}>
            ⚠️ Double-check the full recipient address before sending.
            Sent funds cannot be recovered.
          </Text>
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled, { height: 56 * uiScale }]}
          onPress={handleSend}
          disabled={sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[styles.sendBtnText, { fontSize: fontSize.lg }]}>Send {coinConfig.name}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <CoinPickerModal
        visible={picking}
        onSelect={setCoin}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl },
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
  field: { gap: SPACING.xs },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  maxBtn: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.heavy, textDecorationLine: 'underline' },
  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  inputError: { borderColor: COLORS.danger },
  fieldError: { color: COLORS.danger, fontSize: FONT_SIZE.xs },
  usdHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  coinSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  coinIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  coinIconText: { fontSize: 18, fontWeight: FONT_WEIGHT.heavy },
  coinName: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  coinBalance: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  chevron: { color: COLORS.textMuted },
  feeNote: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  feeEstimate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feeEstimateLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  feeEstimateValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  warning: {
    backgroundColor: '#1A0A0A',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  warningText: { color: COLORS.warning, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  sendBtn: {
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#000', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.heavy },
  // Success
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  successIcon: { fontSize: 64 },
  successTitle: { color: COLORS.text, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.heavy },
  successHash: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  explorerLink: { color: COLORS.primary, fontSize: FONT_SIZE.sm, textDecorationLine: 'underline' },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  doneBtnText: { color: COLORS.text, fontWeight: FONT_WEIGHT.heavy, fontSize: FONT_SIZE.md },
});
