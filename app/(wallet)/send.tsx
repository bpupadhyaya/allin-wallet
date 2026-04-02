/**
 * Send Screen
 * -----------
 * Supports sending ETH, SOL, and SPL tokens (USDC/USDT on Solana).
 * BTC send is stubbed with a clear explanation — Bitcoin UTXO management
 * requires fee-rate selection and CPFP/RBF handling, planned for next release.
 *
 * All signing happens locally; private key never leaves the device.
 */
import React, { useState } from 'react';
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
import { formatUsd, toUsd } from '../../src/services/prices';
import { COINS, COIN_LIST, type CoinSymbol } from '../../src/constants/coins';
import { RPC } from '../../src/constants/config';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';

// Sendable coins (BTC send coming in next release)
const SENDABLE: CoinSymbol[] = [
  'ETH', 'USDC_ETH', 'USDT_ETH',
  'SOL', 'USDC_SOL', 'USDT_SOL',
];

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
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>Select Asset</Text>
          <ScrollView>
            {COIN_LIST.filter((c) => SENDABLE.includes(c.symbol)).map((coin) => (
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
            {/* BTC info row */}
            <View style={modal.btcRow}>
              <View style={[modal.icon, { backgroundColor: '#F7931A22' }]}>
                <Text style={[modal.iconText, { color: '#F7931A' }]}>₿</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modal.name}>Bitcoin</Text>
                <Text style={[modal.chain, { color: COLORS.warning }]}>
                  BTC send — coming soon
                </Text>
              </View>
            </View>
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
    maxHeight: '70%',
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
  btcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    opacity: 0.5,
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

// ─── Send logic ───────────────────────────────────────────────────────────────

async function sendEth(
  mnemonic: string,
  to: string,
  amount: number,
  coin: CoinSymbol,
): Promise<string> {
  const signer = await getEthSigner(mnemonic, RPC.ETHEREUM);

  if (coin === 'ETH') {
    const tx = await signer.sendTransaction({
      to,
      value: ethers.parseEther(amount.toString()),
    });
    return tx.hash;
  }

  // ERC-20 transfer
  const config = COINS[coin];
  const erc20 = new ethers.Contract(
    config.contractAddress!,
    ['function transfer(address to, uint256 amount) returns (bool)'],
    signer,
  );
  const decimals = config.decimals;
  const amountWei = BigInt(Math.floor(amount * 10 ** decimals));
  const tx = await erc20.transfer(to, amountWei);
  return tx.hash;
}

async function sendSol(
  mnemonic: string,
  to: string,
  amount: number,
  coin: CoinSymbol,
): Promise<string> {
  const keypair = await getSolKeypair(mnemonic);
  const connection = new Connection(RPC.SOLANA, 'confirmed');
  const toPubkey = new PublicKey(to);

  if (coin === 'SOL') {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      }),
    );
    const sig = await connection.sendTransaction(tx, [keypair]);
    return sig;
  }

  // SPL token transfer
  const config = COINS[coin];
  const mint = new PublicKey(config.contractAddress!);
  const fromAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
  const toAta = await getAssociatedTokenAddress(mint, toPubkey);
  const amountUnits = BigInt(Math.floor(amount * 10 ** config.decimals));

  const tx = new Transaction().add(
    createTransferInstruction(fromAta, toAta, keypair.publicKey, amountUnits, [], TOKEN_PROGRAM_ID),
  );
  const sig = await connection.sendTransaction(tx, [keypair]);
  return sig;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SendScreen() {
  const { balances, prices } = useAppStore();
  const [coin, setCoin] = useState<CoinSymbol>('SOL');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [txHash, setTxHash] = useState('');

  const coinConfig = COINS[coin];
  const balance = balances[coin];
  const price = prices[coin];
  const usdValue = amount ? toUsd(parseFloat(amount) || 0, price) : 0;

  function validateAddress(addr: string): boolean {
    if (!addr.trim()) {
      setAddressError('Recipient address is required');
      return false;
    }
    const chain = coinConfig.chain;
    if (chain === 'ethereum' && !ethers.isAddress(addr)) {
      setAddressError('Invalid Ethereum address');
      return false;
    }
    if (chain === 'solana') {
      try { new PublicKey(addr); } catch {
        setAddressError('Invalid Solana address');
        return false;
      }
    }
    setAddressError('');
    return true;
  }

  function validateAmount(val: string): boolean {
    const num = parseFloat(val);
    if (!val || isNaN(num) || num <= 0) {
      setAmountError('Enter a valid amount');
      return false;
    }
    if (num > balance) {
      setAmountError(`Insufficient balance (${balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${coin})`);
      return false;
    }
    setAmountError('');
    return true;
  }

  async function handleSend() {
    const addrOk = validateAddress(toAddress.trim());
    const amtOk = validateAmount(amount);
    if (!addrOk || !amtOk) return;

    Alert.alert(
      'Confirm Send',
      `Send ${amount} ${coin}\nTo: ${toAddress.slice(0, 12)}…${toAddress.slice(-8)}\n\nThis is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            try {
              const mnemonic = await getMnemonic();
              if (!mnemonic) throw new Error('Wallet locked — please log in again.');

              let hash: string;
              const chain = coinConfig.chain;

              if (chain === 'ethereum') {
                hash = await sendEth(mnemonic, toAddress.trim(), parseFloat(amount), coin);
              } else if (chain === 'solana') {
                hash = await sendSol(mnemonic, toAddress.trim(), parseFloat(amount), coin);
              } else {
                throw new Error('BTC send is not yet supported.');
              }

              setTxHash(hash);
              setAmount('');
              setToAddress('');
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Transaction failed';
              Alert.alert('Send Failed', msg);
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  if (txHash) {
    const explorerUrl =
      coinConfig.chain === 'ethereum'
        ? `https://etherscan.io/tx/${txHash}`
        : `https://solscan.io/tx/${txHash}`;

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successScreen}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Transaction Sent!</Text>
          <Text style={styles.successHash} numberOfLines={2} selectable>
            {txHash}
          </Text>
          <Text style={styles.successExplorer}>{explorerUrl}</Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => setTxHash('')}
          >
            <Text style={styles.doneBtnText}>Send Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Send</Text>
        <Text style={styles.subtitle}>Transfers are signed locally and broadcast directly.</Text>

        {/* Security notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            🔐 Your private key never leaves this device. Always verify the
            recipient address. Transactions are irreversible.
          </Text>
        </View>

        {/* Asset selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Asset</Text>
          <TouchableOpacity
            style={styles.coinSelector}
            onPress={() => setPicking(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.coinSelectorIcon, { backgroundColor: coinConfig.color + '22' }]}>
              <Text style={[styles.coinSelectorIconText, { color: coinConfig.color }]}>
                {coinConfig.icon}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coinSelectorName}>{coinConfig.name}</Text>
              <Text style={styles.coinSelectorBalance}>
                Balance: {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {coin}
              </Text>
            </View>
            <Text style={styles.chevron}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* Recipient */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Recipient Address</Text>
          <TextInput
            style={[styles.input, addressError ? styles.inputError : null]}
            placeholder={
              coinConfig.chain === 'ethereum'
                ? '0x...'
                : coinConfig.chain === 'solana'
                  ? 'Base58 Solana address'
                  : 'bc1...'
            }
            placeholderTextColor={COLORS.textMuted}
            value={toAddress}
            onChangeText={(t) => { setToAddress(t); setAddressError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {addressError ? <Text style={styles.fieldError}>{addressError}</Text> : null}
        </View>

        {/* Amount */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Amount</Text>
            <TouchableOpacity onPress={() => setAmount(balance.toString())}>
              <Text style={styles.maxBtn}>MAX</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, amountError ? styles.inputError : null]}
            placeholder={`0.00 ${coin}`}
            placeholderTextColor={COLORS.textMuted}
            value={amount}
            onChangeText={(t) => { setAmount(t); setAmountError(''); }}
            keyboardType="decimal-pad"
          />
          {amountError ? (
            <Text style={styles.fieldError}>{amountError}</Text>
          ) : amount ? (
            <Text style={styles.usdHint}>≈ {formatUsd(usdValue)}</Text>
          ) : null}
        </View>

        {/* Warning */}
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠️ Double-check the full recipient address before sending.
            Sent funds cannot be recovered.
          </Text>
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.sendBtnText}>Send {coinConfig.name}</Text>
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
  fieldGroup: { gap: SPACING.xs },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '500' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  maxBtn: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
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
  coinSelectorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinSelectorIconText: { fontSize: 18, fontWeight: '700' },
  coinSelectorName: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' },
  coinSelectorBalance: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  chevron: { color: COLORS.textMuted },
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
  sendBtnText: { color: '#000', fontSize: FONT_SIZE.lg, fontWeight: '800' },
  // Success state
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  successIcon: { fontSize: 64 },
  successTitle: { color: COLORS.text, fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  successHash: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  successExplorer: { color: COLORS.primary, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  doneBtnText: { color: COLORS.text, fontWeight: '700', fontSize: FONT_SIZE.md },
});
