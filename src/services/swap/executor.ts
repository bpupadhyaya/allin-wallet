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
 */
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as btcSigner from '@scure/btc-signer';
import axios from 'axios';
import { getMnemonic } from '../storage';
import { getEthSigner, getSolKeypair, getBtcPrivateKey } from '../../crypto/wallets';
import { RPC } from '../../constants/config';
import { COINS } from '../../constants/coins';
import type { SwapQuote } from './router';

export interface SwapResult {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  explorerUrl: string;
}

// ─── Public entry ────────────────────────────────────────────────────────────

export async function executeSwap(
  quote: SwapQuote,
  /** Sender's BTC address — needed only for Bitcoin source swaps */
  btcSenderAddress?: string,
): Promise<SwapResult> {
  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('Wallet locked — please log in again.');

  const from = COINS[quote.fromCoin];

  switch (from.chain) {
    case 'ethereum':
      return executeEthSwap(quote, mnemonic);
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

async function executeEthSwap(
  quote: SwapQuote,
  mnemonic: string,
): Promise<SwapResult> {
  const signer = await getEthSigner(mnemonic, RPC.ETHEREUM);

  // Li.Fi quote contains a ready-to-sign transactionRequest
  const txReq = (quote.rawData as {
    transactionRequest?: {
      to: string;
      data: string;
      value?: string;
      gasLimit?: string;
    };
  }).transactionRequest;

  if (!txReq) throw new Error('Li.Fi quote missing transactionRequest');

  const tx = await signer.sendTransaction({
    to: txReq.to,
    data: txReq.data,
    value: txReq.value ? BigInt(txReq.value) : 0n,
    ...(txReq.gasLimit ? { gasLimit: BigInt(txReq.gasLimit) } : {}),
  });

  return {
    txHash: tx.hash,
    status: 'pending',
    explorerUrl: `https://etherscan.io/tx/${tx.hash}`,
  };
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

  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

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

  if (!rawData.inbound_address || !rawData.memo) {
    throw new Error('THORChain quote missing inbound_address or memo');
  }

  // 1. Fetch UTXOs for the sender address
  const utxos = await fetchBtcUtxos(senderAddress);
  if (utxos.length === 0) throw new Error('No UTXOs available');

  const amountSats = Math.round(quote.fromAmount * 1e8);
  // Fee estimation: 1 sat/vbyte × ~250 vbytes for a typical P2WPKH tx + OP_RETURN
  const feeSats = 1500;
  const totalNeeded = amountSats + feeSats;

  // 2. Coin selection (largest-first)
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected: BtcUtxo[] = [];
  let selectedTotal = 0;
  for (const u of sorted) {
    selected.push(u);
    selectedTotal += u.value;
    if (selectedTotal >= totalNeeded) break;
  }
  if (selectedTotal < totalNeeded) {
    throw new Error(
      `Insufficient BTC balance. Need ${(totalNeeded / 1e8).toFixed(8)} BTC.`,
    );
  }

  const changeSats = selectedTotal - amountSats - feeSats;
  const btcPrivKey = await getBtcPrivateKey(mnemonic);

  // 3. Build P2WPKH transaction
  const tx = new btcSigner.Transaction();

  // Add inputs
  for (const utxo of selected) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: btcSigner.p2wpkh(
          btcSigner.utils.pubkeyToUncompressed(
            btcSigner.utils.privkeyToPublicKey(btcPrivKey),
          ),
        ).script,
        amount: BigInt(utxo.value),
      },
    });
  }

  // Add output to THORChain inbound vault
  tx.addOutput({
    address: rawData.inbound_address,
    amount: BigInt(amountSats),
  });

  // Add OP_RETURN output with THORChain memo (required for routing)
  const memoBytes = new TextEncoder().encode(rawData.memo);
  if (memoBytes.length > 80) throw new Error('THORChain memo exceeds 80 bytes');
  tx.addOutput({
    script: btcSigner.Script.encode(['OP_RETURN', memoBytes]),
    amount: 0n,
  });

  // Add change output if meaningful
  if (changeSats > 546) {
    tx.addOutput({ address: senderAddress, amount: BigInt(changeSats) });
  }

  // Sign all inputs
  for (let i = 0; i < selected.length; i++) {
    tx.signIdx(btcPrivKey, i);
  }
  tx.finalize();

  // 4. Broadcast via mempool.space
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
