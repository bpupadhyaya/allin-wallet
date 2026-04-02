/**
 * Bitcoin Send Service
 * --------------------
 * Constructs, signs, and broadcasts a standard P2WPKH Bitcoin transfer.
 * Separate from the THORChain swap flow (no OP_RETURN memo needed here).
 */
import * as btcSigner from '@scure/btc-signer';
import axios from 'axios';
import { getMnemonic } from './storage';
import { getBtcPrivateKey } from '../crypto/wallets';
import { fetchBtcFeeRates, estimateBtcVbytes } from './fees';
import { RPC } from '../constants/config';

export interface BtcUtxo {
  txid: string;
  vout: number;
  value: number; // satoshis
  status: { confirmed: boolean };
}

export async function fetchBtcUtxos(address: string): Promise<BtcUtxo[]> {
  const { data } = await axios.get<BtcUtxo[]>(
    `${RPC.BITCOIN_API}/address/${address}/utxo`,
    { timeout: 10000 },
  );
  return data.filter((u) => u.status.confirmed);
}

export interface BtcSendParams {
  toAddress: string;
  amountBtc: number;
  /** sat/vbyte fee rate */
  feeRateSatVbyte: number;
  senderAddress: string;
}

export interface BtcSendResult {
  txHash: string;
  feeBtc: number;
  explorerUrl: string;
}

export async function sendBtc(params: BtcSendParams): Promise<BtcSendResult> {
  const { toAddress, amountBtc, feeRateSatVbyte, senderAddress } = params;
  const mnemonic = await getMnemonic();
  if (!mnemonic) throw new Error('Wallet locked — please log in again.');

  const utxos = await fetchBtcUtxos(senderAddress);
  if (utxos.length === 0) throw new Error('No confirmed UTXOs available.');

  const amountSats = Math.round(amountBtc * 1e8);

  // Coin selection: largest-first (greedy)
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected: BtcUtxo[] = [];
  let selectedTotal = 0;

  for (const u of sorted) {
    selected.push(u);
    selectedTotal += u.value;
    const vbytes = estimateBtcVbytes(selected.length, 2);
    const feeSats = Math.ceil(vbytes * feeRateSatVbyte);
    if (selectedTotal >= amountSats + feeSats) break;
  }

  // Final fee with selected input count
  const finalVbytes = estimateBtcVbytes(selected.length, 2);
  const feeSats = Math.ceil(finalVbytes * feeRateSatVbyte);
  const totalNeeded = amountSats + feeSats;

  if (selectedTotal < totalNeeded) {
    throw new Error(
      `Insufficient balance. Need ${(totalNeeded / 1e8).toFixed(8)} BTC ` +
      `(including ${(feeSats / 1e8).toFixed(8)} BTC fee at ${feeRateSatVbyte} sat/vbyte).`,
    );
  }

  const changeSats = selectedTotal - amountSats - feeSats;

  const btcPrivKey = await getBtcPrivateKey(mnemonic);
  const pubKey = btcSigner.utils.pubkeyToUncompressed(
    btcSigner.utils.privkeyToPublicKey(btcPrivKey),
  );
  const senderScript = btcSigner.p2wpkh(pubKey).script;

  const tx = new btcSigner.Transaction();

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

  // Recipient output
  tx.addOutput({ address: toAddress, amount: BigInt(amountSats) });

  // Change output (dust threshold: 546 sats)
  if (changeSats > 546) {
    tx.addOutput({ address: senderAddress, amount: BigInt(changeSats) });
  }

  // Sign all inputs
  for (let i = 0; i < selected.length; i++) {
    tx.signIdx(btcPrivKey, i);
  }
  tx.finalize();

  const txHex = Buffer.from(tx.extract()).toString('hex');
  const { data: txHash } = await axios.post<string>(
    `${RPC.BITCOIN_API}/tx`,
    txHex,
    { headers: { 'Content-Type': 'text/plain' }, timeout: 15000 },
  );

  return {
    txHash,
    feeBtc: feeSats / 1e8,
    explorerUrl: `https://mempool.space/tx/${txHash}`,
  };
}
