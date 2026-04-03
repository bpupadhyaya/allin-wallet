/**
 * Swap Executor
 * -------------
 * Signs and broadcasts swap transactions. Called only after the user confirms.
 * Private keys are loaded from SecureStore once, used immediately, and never
 * stored in a variable beyond the scope of the signing call.
 *
 * Provider routing:
 *  • EVM source (ETH, USDC_ETH, USDT_ETH) → Li.Fi EVM transaction
 *  • Solana source (SOL, USDC_SOL, USDT_SOL) → Li.Fi Solana transaction
 *  • Bitcoin source (BTC) → THORChain UTXO transaction
 *
 * ERC-20 note: when the source token is an ERC-20 (USDC/USDT on Ethereum),
 * we check the Li.Fi spender allowance and submit an approve tx first if
 * needed — blocking until the approval is confirmed (1 block).
 */
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as btcSigner from '@scure/btc-signer';
import axios from 'axios';
import { getMnemonic } from '../storage';
import { getEthSigner, getSolKeypair, getBtcKeyPair } from '../../crypto/wallets';
import { fetchBtcFeeRates, estimateBtcVbytes } from '../fees';
import { RPC } from '../../constants/config';
import { COINS } from '../../constants/coins';
import type { SwapQuote } from './router';

export interface SwapResult {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  explorerUrl: string;
}

// ─── Public entry ────────────────────────────────────────────────────────────

/**
 * Execute a confirmed swap.
 * @param quote  Quote obtained from getSwapQuote()
 * @param btcSenderAddress  Sender BTC address — required only for BTC-source swaps
 * @param onStatusUpdate  Optional callback fired when a pending ETH tx finalises
 */
export async function executeSwap(
  quote: SwapQuote,
  btcSenderAddress?: string,
  onStatusUpdate?: (txHash: string, status: 'confirmed' | 'failed') => void,
): Promise<SwapResult> {
  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('Wallet locked — please log in again.');

  const from = COINS[quote.fromCoin];

  switch (from.chain) {
    case 'ethereum':
      return executeEthSwap(quote, mnemonic, onStatusUpdate);
    case 'solana':
      return executeSolSwap(quote, mnemonic);
    case 'bitcoin':
      if (!btcSenderAddress) throw new Error('BTC sender address required');
      return executeBtcSwap(quote, mnemonic, btcSenderAddress);
    default:
      throw new Error(`Unsupported source chain: ${from.chain}`);
  }
}

// ─── EVM (Ethereum) ──────────────────────────────────────────────────────────

/**
 * Li.Fi EVM swap.
 * For ERC-20 source tokens (USDC_ETH, USDT_ETH) we check and submit an ERC-20
 * approval to the Li.Fi spender contract before broadcasting the swap tx.
 */
async function executeEthSwap(
  quote: SwapQuote,
  mnemonic: string,
  onStatusUpdate?: (txHash: string, status: 'confirmed' | 'failed') => void,
): Promise<SwapResult> {
  const signer = await getEthSigner(mnemonic, RPC.ETHEREUM);
  const from = COINS[quote.fromCoin];

  // Li.Fi quote contains a ready-to-sign transactionRequest
  const lifiData = quote.rawData as {
    estimate: { approvalAddress?: string };
    action: { fromAmount: string; fromToken: { address: string } };
    transactionRequest?: {
      to: string;
      data: string;
      value?: string;
      gasLimit?: string;
    };
  };

  if (!lifiData.transactionRequest) {
    throw new Error('Li.Fi quote missing transactionRequest');
  }

  // ── ERC-20 approval ──────────────────────────────────────────────────────
  // When selling an ERC-20 token (USDC/USDT), the Li.Fi router contract must
  // be approved to spend that token on behalf of the user.
  if (!from.isNative && lifiData.estimate.approvalAddress) {
    await ensureERC20Allowance(
      signer,
      from.contractAddress!,
      lifiData.estimate.approvalAddress,
      BigInt(lifiData.action.fromAmount),
    );
  }

  // ── Swap transaction ─────────────────────────────────────────────────────
  const txReq = lifiData.transactionRequest;
  const tx = await signer.sendTransaction({
    to: txReq.to,
    data: txReq.data,
    value: txReq.value ? BigInt(txReq.value) : 0n,
    ...(txReq.gasLimit ? { gasLimit: BigInt(txReq.gasLimit) } : {}),
  });

  // ── Background confirmation polling ──────────────────────────────────────
  // ETH tx can take 15 s – several minutes; we don't block the UI.
  // The caller receives a callback once the receipt arrives (or times out).
  if (onStatusUpdate) {
    const provider = signer.provider!;
    provider
      .waitForTransaction(tx.hash, 1, 10 * 60 * 1000) // up to 10 min
      .then(() => onStatusUpdate(tx.hash, 'confirmed'))
      .catch(() => onStatusUpdate(tx.hash, 'failed'));
  }

  return {
    txHash: tx.hash,
    status: 'pending',
    explorerUrl: `https://etherscan.io/tx/${tx.hash}`,
  };
}

/**
 * Checks current ERC-20 allowance for the given spender and submits an
 * unlimited approval if the allowance is below the required amount.
 * Waits for the approval tx to confirm (1 block) before returning.
 */
async function ensureERC20Allowance(
  signer: ethers.Wallet,
  tokenAddress: string,
  spender: string,
  requiredAmount: bigint,
): Promise<void> {
  const erc20 = new ethers.Contract(
    tokenAddress,
    [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ],
    signer,
  );

  const currentAllowance: bigint = await erc20.allowance(
    signer.address,
    spender,
  );
  if (currentAllowance >= requiredAmount) return; // already approved

  // Approve max uint256 to avoid repeated approval txs in the future
  const approveTx = await erc20.approve(spender, ethers.MaxUint256);
  // Wait 1 confirmation so the swap tx sees the updated allowance
  await approveTx.wait(1);
}

// ─── Solana ───────────────────────────────────────────────────────────────────

async function executeSolSwap(
  quote: SwapQuote,
  mnemonic: string,
): Promise<SwapResult> {
  const keypair = await getSolKeypair(mnemonic);
  const connection = new Connection(RPC.SOLANA, 'confirmed');

  // Li.Fi encodes the Solana transaction as base64 in transactionRequest.data
  const encoded = (quote.rawData as {
    transactionRequest?: { data?: string };
  }).transactionRequest?.data;

  if (!encoded) throw new Error('Li.Fi quote missing Solana transaction data');

  const txBuffer = Buffer.from(encoded, 'base64');
  const tx = VersionedTransaction.deserialize(txBuffer);

  // Get a fresh blockhash to ensure the transaction isn't expired
  const { value: { blockhash, lastValidBlockHeight } } =
    await connection.getLatestBlockhashAndContext('confirmed');
  tx.message.recentBlockhash = blockhash;

  tx.sign([keypair]);

  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  return {
    txHash: sig,
    status: 'confirmed',
    explorerUrl: `https://solscan.io/tx/${sig}`,
  };
}

// ─── Bitcoin via THORChain ────────────────────────────────────────────────────

interface BtcUtxo {
  txid: string;
  vout: number;
  value: number; // satoshis
  status: { confirmed: boolean };
}

async function executeBtcSwap(
  quote: SwapQuote,
  mnemonic: string,
  senderAddress: string,
): Promise<SwapResult> {
  const rawData = quote.rawData as {
    inbound_address: string;
    memo: string;
    recommended_min_amount_in?: string;
  };

  // router.ts already validates these, but guard here too
  if (!rawData.inbound_address || !rawData.memo) {
    throw new Error('THORChain quote missing inbound_address or memo');
  }

  // 1. Fetch UTXOs
  const utxos = await fetchBtcUtxos(senderAddress);
  if (utxos.length === 0) throw new Error('No confirmed UTXOs available');

  const amountSats = Math.round(quote.fromAmount * 1e8);

  // 2. Dynamic fee estimation (THORChain tx has 3 outputs: vault + OP_RETURN + change)
  const feeRates = await fetchBtcFeeRates();
  const feeRateSatVbyte = feeRates.standard;
  const NUM_OUTPUTS = 3;

  // Iterative coin selection: grow the input set until we have enough
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected: BtcUtxo[] = [];
  let selectedTotal = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    selectedTotal += utxo.value;
    const vbytes = estimateBtcVbytes(selected.length, NUM_OUTPUTS);
    const feeSats = Math.ceil(vbytes * feeRateSatVbyte);
    if (selectedTotal >= amountSats + feeSats) break;
  }

  // Final fee with the actual selected input count
  const finalVbytes = estimateBtcVbytes(selected.length, NUM_OUTPUTS);
  const feeSats = Math.ceil(finalVbytes * feeRateSatVbyte);
  const totalNeeded = amountSats + feeSats;

  if (selectedTotal < totalNeeded) {
    throw new Error(
      `Insufficient BTC balance. Need ${(totalNeeded / 1e8).toFixed(8)} BTC ` +
      `(including ${(feeSats / 1e8).toFixed(8)} BTC fee at ${feeRateSatVbyte} sat/vbyte).`,
    );
  }

  const changeSats = selectedTotal - amountSats - feeSats;

  // 3. Derive keys — getBtcKeyPair returns the compressed pubkey needed for P2WPKH
  const { privateKey: btcPrivKey, publicKey: btcPubKey } =
    await getBtcKeyPair(mnemonic);

  // p2wpkh(compressed pubkey) gives us the witnessScript for each input
  const senderScript = btcSigner.p2wpkh(btcPubKey).script;

  // 4. Build P2WPKH transaction
  // allowUnknownOutputs is required because OP_RETURN outputs are classified
  // as 'unknown' type by btc-signer and are rejected without this flag.
  const tx = new btcSigner.Transaction({ allowUnknownOutputs: true });

  // Add inputs
  for (const utxo of selected) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: senderScript,
        amount: BigInt(utxo.value),
      },
    });
  }

  // Output to THORChain inbound vault
  tx.addOutput({
    address: rawData.inbound_address,
    amount: BigInt(amountSats),
  });

  // OP_RETURN with THORChain memo (required for routing to destination chain).
  // Note: the opcode key in @scure/btc-signer's OP enum is 'RETURN', not 'OP_RETURN'.
  const memoBytes = new TextEncoder().encode(rawData.memo);
  if (memoBytes.length > 80) {
    throw new Error(
      `THORChain memo is ${memoBytes.length} bytes (max 80). The swap pair may not be supported.`,
    );
  }
  tx.addOutput({
    script: btcSigner.Script.encode(['RETURN', memoBytes]),
    amount: 0n,
  });

  // Change output (dust threshold: 546 sats)
  if (changeSats > 546) {
    tx.addOutput({ address: senderAddress, amount: BigInt(changeSats) });
  }

  // 5. Sign all inputs
  for (let i = 0; i < selected.length; i++) {
    tx.signIdx(btcPrivKey, i);
  }
  tx.finalize();

  // 6. Broadcast via mempool.space
  const txHex = Buffer.from(tx.extract()).toString('hex');
  const { data: txHash } = await axios.post<string>(
    `${RPC.BITCOIN_API}/tx`,
    txHex,
    { headers: { 'Content-Type': 'text/plain' }, timeout: 15000 },
  );

  return {
    txHash,
    status: 'pending',
    explorerUrl: `https://mempool.space/tx/${txHash}`,
  };
}

async function fetchBtcUtxos(address: string): Promise<BtcUtxo[]> {
  const { data } = await axios.get<BtcUtxo[]>(
    `${RPC.BITCOIN_API}/address/${address}/utxo`,
    { timeout: 10000 },
  );
  // Only use confirmed UTXOs for safety
  return data.filter((u) => u.status.confirmed);
}
