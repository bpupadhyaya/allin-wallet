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
import { getEthSigner, getSolKeypair, getBtcKeyPair, getBtcNetwork, getDogeKeyPair, getDogeNetwork, getXrpKeyPair, getPolSigner } from '../../crypto/wallets';
import { fetchBtcFeeRates, estimateBtcVbytes } from '../fees';
import { getRpc, getExplorerTxUrl, IS_DEV, DEV_MNEMONIC } from '../../constants/config';
import { COINS } from '../../constants/coins';
import type { SwapQuote } from './router';

// Known Li.Fi diamond proxy contracts — https://docs.li.fi/smart-contracts/deployments
const LIFI_APPROVED_SPENDERS: ReadonlySet<string> = new Set([
  '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae', // LiFi Diamond (primary)
  '0x341e94069f53234fe6dabef707ad424830525715', // LiFi Diamond Immutable
].map(a => a.toLowerCase()));

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
  if (quote.expiresAt && Date.now() > quote.expiresAt) {
    throw new Error('Quote has expired. Please get a fresh quote before swapping.');
  }

  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('Wallet locked — please log in again.');

  // ── Dev mock — the "abandon" mnemonic has no real funds on any network,
  //    so simulate a successful swap for testing the UI flow.
  //    Only triggers for the exact dev mnemonic; real wallets always go live.
  if (IS_DEV && mnemonic === DEV_MNEMONIC) {
    const fakeTxHash =
      'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const from = COINS[quote.fromCoin];
    return {
      txHash: fakeTxHash,
      status: 'confirmed',
      explorerUrl: getExplorerTxUrl(from.chain, fakeTxHash),
    };
  }

  const from = COINS[quote.fromCoin];

  switch (from.chain) {
    case 'ethereum':
      return executeEthSwap(quote, mnemonic, onStatusUpdate);
    case 'solana':
      return executeSolSwap(quote, mnemonic);
    case 'bitcoin':
      if (!btcSenderAddress) throw new Error('BTC sender address required');
      return executeBtcSwap(quote, mnemonic, btcSenderAddress);
    case 'dogecoin':
      if (!btcSenderAddress) throw new Error('DOGE sender address required');
      return executeDogeSwap(quote, mnemonic, btcSenderAddress);
    case 'xrp':
      if (!btcSenderAddress) throw new Error('XRP sender address required');
      return executeXrpSwap(quote, mnemonic, btcSenderAddress);
    case 'polygon':
      return executePolSwap(quote, mnemonic, onStatusUpdate);
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
  const signer = await getEthSigner(mnemonic, getRpc().ETHEREUM);
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

  if (!lifiData.transactionRequest?.to || !lifiData.transactionRequest?.data) {
    throw new Error('Li.Fi quote missing or incomplete transactionRequest');
  }
  if (!lifiData.action?.fromAmount) {
    throw new Error('Li.Fi quote missing fromAmount in action');
  }

  // ── ERC-20 approval ──────────────────────────────────────────────────────
  // When selling an ERC-20 token (USDC/USDT), the Li.Fi router contract must
  // be approved to spend that token on behalf of the user.
  if (!from.isNative && lifiData.estimate.approvalAddress) {
    const spender = lifiData.estimate.approvalAddress.toLowerCase();
    if (!LIFI_APPROVED_SPENDERS.has(spender)) {
      throw new Error(
        'Li.Fi returned an unrecognized spender address. Swap aborted for safety.',
      );
    }
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
      .then((receipt) => {
        // status 0 = reverted, 1 = success
        onStatusUpdate(tx.hash, receipt && receipt.status === 1 ? 'confirmed' : 'failed');
      })
      .catch(() => {
        // Timeout or network error — don't mark as failed since tx may still be pending
        // User can check explorer. We leave status as 'pending'.
      });
  }

  return {
    txHash: tx.hash,
    status: 'pending',
    explorerUrl: getExplorerTxUrl('ethereum', tx.hash),
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

  // Reset allowance to 0 first if non-zero (required by some tokens like USDT)
  if (currentAllowance > 0n) {
    const resetTx = await erc20.approve(spender, 0n);
    await resetTx.wait(1);
  }

  // Approve exact amount needed — avoid unlimited approval for security
  const approveTx = await erc20.approve(spender, requiredAmount);
  // Wait 1 confirmation so the swap tx sees the updated allowance
  await approveTx.wait(1);
}

// ─── Solana ───────────────────────────────────────────────────────────────────

async function executeSolSwap(
  quote: SwapQuote,
  mnemonic: string,
): Promise<SwapResult> {
  const keypair = await getSolKeypair(mnemonic);
  const connection = new Connection(getRpc().SOLANA, 'confirmed');

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

  try {
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed',
    );
  } catch (confirmErr: unknown) {
    const msg = confirmErr instanceof Error ? confirmErr.message : String(confirmErr);
    if (msg.includes('block height exceeded') || msg.includes('Blockhash not found')) {
      throw new Error(
        'Transaction expired — the Solana network was too congested. Please try again.',
      );
    }
    throw confirmErr;
  }

  return {
    txHash: sig,
    status: 'confirmed',
    explorerUrl: getExplorerTxUrl('solana', sig),
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
  const senderScript = btcSigner.p2wpkh(btcPubKey, getBtcNetwork()).script;

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
  } else if (changeSats > 0) {
    // Dust change absorbed into fee — not worth creating an output
    // Total effective fee = feeSats + changeSats
  }

  // 5. Sign all inputs
  for (let i = 0; i < selected.length; i++) {
    tx.signIdx(btcPrivKey, i);
  }
  tx.finalize();

  // 6. Broadcast via mempool.space
  const txHex = Buffer.from(tx.extract()).toString('hex');
  const { data: txHash } = await axios.post<string>(
    `${getRpc().BITCOIN_API}/tx`,
    txHex,
    { headers: { 'Content-Type': 'text/plain' }, timeout: 15000 },
  );

  return {
    txHash,
    status: 'pending',
    explorerUrl: getExplorerTxUrl('bitcoin', txHash),
  };
}

async function fetchBtcUtxos(address: string): Promise<BtcUtxo[]> {
  const { data } = await axios.get<BtcUtxo[]>(
    `${getRpc().BITCOIN_API}/address/${address}/utxo`,
    { timeout: 10000 },
  );
  return data.filter((u) => u.status.confirmed);
}

// ─── Dogecoin via THORChain ───────────────────────────────────────────────
// DOGE is UTXO-based like BTC but uses P2PKH (no SegWit).

async function executeDogeSwap(
  quote: SwapQuote,
  mnemonic: string,
  senderAddress: string,
): Promise<SwapResult> {
  const rawData = quote.rawData as {
    inbound_address: string;
    memo: string;
  };

  if (!rawData.inbound_address || !rawData.memo) {
    throw new Error('THORChain quote missing inbound_address or memo');
  }

  // Fetch UTXOs from dogechain.info
  const utxos = await fetchDogeUtxos(senderAddress);
  if (utxos.length === 0) throw new Error('No confirmed DOGE UTXOs available');

  const amountSats = Math.round(quote.fromAmount * 1e8);
  const feeRateSatVbyte = 10; // DOGE fees are very low
  const NUM_OUTPUTS = 3;

  // Coin selection
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected: BtcUtxo[] = [];
  let selectedTotal = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    selectedTotal += utxo.value;
    // P2PKH: ~148 bytes per input, ~34 per output, ~10 overhead
    const estSize = selected.length * 148 + NUM_OUTPUTS * 34 + 10;
    const feeSats = Math.ceil(estSize * feeRateSatVbyte);
    if (selectedTotal >= amountSats + feeSats) break;
  }

  const estSize = selected.length * 148 + NUM_OUTPUTS * 34 + 10;
  const feeSats = Math.ceil(estSize * feeRateSatVbyte);
  const totalNeeded = amountSats + feeSats;

  if (selectedTotal < totalNeeded) {
    throw new Error(`Insufficient DOGE balance. Need ${(totalNeeded / 1e8).toFixed(8)} DOGE.`);
  }

  const changeSats = selectedTotal - amountSats - feeSats;

  const { privateKey: dogePrivKey, publicKey: dogePubKey } = await getDogeKeyPair(mnemonic);
  const dogeNet = getDogeNetwork();
  const senderScript = btcSigner.p2pkh(dogePubKey, dogeNet).script;

  const tx = new btcSigner.Transaction({ allowUnknownOutputs: true });

  for (const utxo of selected) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script: senderScript, amount: BigInt(utxo.value) },
    });
  }

  tx.addOutput({ address: rawData.inbound_address, amount: BigInt(amountSats) });

  const memoBytes = new TextEncoder().encode(rawData.memo);
  tx.addOutput({ script: btcSigner.Script.encode(['RETURN', memoBytes]), amount: 0n });

  if (changeSats > 100000) { // DOGE dust threshold ~0.001 DOGE = 100000 sats
    tx.addOutput({ address: senderAddress, amount: BigInt(changeSats) });
  }

  for (let i = 0; i < selected.length; i++) {
    tx.signIdx(dogePrivKey, i);
  }
  tx.finalize();

  const txHex = Buffer.from(tx.extract()).toString('hex');
  // Broadcast via dogechain.info or blockcypher
  const { data: broadcastResult } = await axios.post(
    'https://api.blockcypher.com/v1/doge/main/txs/push',
    { tx: txHex },
    { timeout: 15000 },
  );

  const txHash = broadcastResult.tx?.hash || broadcastResult.hash || txHex.slice(0, 64);
  return {
    txHash,
    status: 'pending',
    explorerUrl: getExplorerTxUrl('dogecoin', txHash),
  };
}

async function fetchDogeUtxos(address: string): Promise<BtcUtxo[]> {
  try {
    const { data } = await axios.get(
      `https://api.blockcypher.com/v1/doge/main/addrs/${address}?unspentOnly=true`,
      { timeout: 10000 },
    );
    return (data.txrefs || []).map((ref: any) => ({
      txid: ref.tx_hash,
      vout: ref.tx_output_n,
      value: ref.value,
      status: { confirmed: ref.confirmations > 0 },
    })).filter((u: BtcUtxo) => u.status.confirmed);
  } catch {
    return [];
  }
}

// ─── Polygon via Li.Fi ────────────────────────────────────────────────────
// POL swaps work like ETH swaps — EVM-compatible, same signing logic.

async function executePolSwap(
  quote: SwapQuote,
  mnemonic: string,
  onStatusUpdate?: (txHash: string, status: 'confirmed' | 'failed') => void,
): Promise<SwapResult> {
  const signer = await getPolSigner(mnemonic, getRpc().POLYGON_RPC);
  const from = COINS[quote.fromCoin];

  const lifiData = quote.rawData as {
    estimate: { approvalAddress?: string };
    action: { fromAmount: string; fromToken: { address: string } };
    transactionRequest?: { to: string; data: string; value?: string; gasLimit?: string };
  };

  if (!lifiData.transactionRequest?.to || !lifiData.transactionRequest?.data) {
    throw new Error('Li.Fi quote missing or incomplete transactionRequest');
  }

  if (!from.isNative && lifiData.estimate.approvalAddress) {
    const spender = lifiData.estimate.approvalAddress.toLowerCase();
    if (!LIFI_APPROVED_SPENDERS.has(spender)) {
      throw new Error('Li.Fi returned an unrecognized spender address. Swap aborted.');
    }
    await ensureERC20Allowance(signer, from.contractAddress!, lifiData.estimate.approvalAddress, BigInt(lifiData.action.fromAmount));
  }

  const txReq = lifiData.transactionRequest;
  const tx = await signer.sendTransaction({
    to: txReq.to,
    data: txReq.data,
    value: txReq.value ? BigInt(txReq.value) : 0n,
    ...(txReq.gasLimit ? { gasLimit: BigInt(txReq.gasLimit) } : {}),
  });

  if (onStatusUpdate) {
    const provider = signer.provider!;
    provider
      .waitForTransaction(tx.hash, 1, 10 * 60 * 1000)
      .then((receipt) => {
        onStatusUpdate(tx.hash, receipt && receipt.status === 1 ? 'confirmed' : 'failed');
      })
      .catch(() => {});
  }

  return {
    txHash: tx.hash,
    status: 'pending',
    explorerUrl: getExplorerTxUrl('polygon', tx.hash),
  };
}

// ─── XRP via THORChain ────────────────────────────────────────────────────
// XRP is account-based. We send a Payment transaction to THORChain's inbound
// vault with the swap memo in the Memos field.

async function executeXrpSwap(
  quote: SwapQuote,
  mnemonic: string,
  senderAddress: string,
): Promise<SwapResult> {
  const rawData = quote.rawData as {
    inbound_address: string;
    memo: string;
  };

  if (!rawData.inbound_address || !rawData.memo) {
    throw new Error('THORChain quote missing inbound_address or memo');
  }

  const { privateKey, publicKey } = await getXrpKeyPair(mnemonic);
  const amountDrops = Math.round(quote.fromAmount * 1e6).toString();

  // Fetch current ledger sequence for the account
  const { data: accountInfo } = await axios.post(getRpc().XRP_RPC, {
    method: 'account_info',
    params: [{ account: senderAddress, ledger_index: 'validated' }],
  }, { timeout: 10000 });

  const sequence = accountInfo.result?.account_data?.Sequence;
  if (sequence === undefined) {
    throw new Error('Could not fetch XRP account sequence. Is the account activated (10 XRP minimum)?');
  }

  // Fetch current ledger index for LastLedgerSequence
  const { data: ledgerInfo } = await axios.post(getRpc().XRP_RPC, {
    method: 'ledger_current',
    params: [{}],
  }, { timeout: 10000 });
  const currentLedger = ledgerInfo.result?.ledger_current_index ?? 0;

  // Build the Payment transaction
  const txJson = {
    TransactionType: 'Payment',
    Account: senderAddress,
    Destination: rawData.inbound_address,
    Amount: amountDrops,
    Fee: '12', // Standard XRP fee (12 drops)
    Sequence: sequence,
    LastLedgerSequence: currentLedger + 20, // ~80 seconds to confirm
    Memos: [{
      Memo: {
        MemoData: Buffer.from(rawData.memo).toString('hex').toUpperCase(),
        MemoType: Buffer.from('text/plain').toString('hex').toUpperCase(),
      },
    }],
  };

  // Serialize, sign, and submit using ripple binary codec
  // We use a lightweight approach: serialize → sign → encode → submit
  const { encode, encodeForSigning } = await import('ripple-binary-codec');
  const forSigning = encodeForSigning(txJson);
  const sigBytes = secp256k1Sign(Buffer.from(forSigning, 'hex'), privateKey);
  const signedTx = {
    ...txJson,
    SigningPubKey: Buffer.from(publicKey).toString('hex').toUpperCase(),
    TxnSignature: Buffer.from(sigBytes).toString('hex').toUpperCase(),
  };
  const txBlob = encode(signedTx);

  // Submit
  const { data: submitResult } = await axios.post(getRpc().XRP_RPC, {
    method: 'submit',
    params: [{ tx_blob: txBlob }],
  }, { timeout: 15000 });

  const engineResult = submitResult.result?.engine_result;
  if (engineResult && engineResult !== 'tesSUCCESS' && !engineResult.startsWith('tes')) {
    throw new Error(`XRP transaction rejected: ${engineResult} — ${submitResult.result?.engine_result_message}`);
  }

  const txHash = submitResult.result?.tx_json?.hash || submitResult.result?.hash || '';

  return {
    txHash,
    status: 'pending',
    explorerUrl: getExplorerTxUrl('xrp', txHash),
  };
}

// Minimal secp256k1 signing for XRP (DER-encoded ECDSA signature)
function secp256k1Sign(msgHash: Buffer, privateKey: Uint8Array): Uint8Array {
  const { sha512 } = require('@noble/hashes/sha512');
  // XRP uses SHA-512 first half as the signing hash
  const hash = sha512(msgHash).slice(0, 32);
  const { secp256k1 } = require('@noble/curves/secp256k1');
  const sig = secp256k1.sign(hash, privateKey, { lowS: true });
  return sig.toDERRawBytes();
}
