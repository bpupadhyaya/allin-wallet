/**
 * Fee estimation service
 * ----------------------
 * BTC  → mempool.space /v1/fees/recommended
 * ETH  → ethers provider.getFeeData() (EIP-1559)
 * SOL  → fixed estimate (~0.000005 SOL per signature, negligible)
 */
import axios from 'axios';
import { ethers } from 'ethers';
import { RPC } from '../constants/config';

// ─── Bitcoin ─────────────────────────────────────────────────────────────────

export interface BtcFeeRates {
  /** ~1 hour confirmation */
  slow: number;
  /** ~30 min confirmation */
  standard: number;
  /** ~10 min (next block) */
  fast: number;
}

export async function fetchBtcFeeRates(): Promise<BtcFeeRates> {
  const { data } = await axios.get<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
  }>(`${RPC.BITCOIN_API}/v1/fees/recommended`, { timeout: 8000 });

  return {
    slow: data.hourFee,
    standard: data.halfHourFee,
    fast: data.fastestFee,
  };
}

/**
 * Estimate virtual bytes for a P2WPKH transaction.
 *   overhead: 10 vbytes
 *   per input: 68 vbytes
 *   per output: 31 vbytes  (2 outputs = destination + change)
 */
export function estimateBtcVbytes(numInputs: number, numOutputs = 2): number {
  return 10 + numInputs * 68 + numOutputs * 31;
}

/** Returns estimated fee in BTC for a given fee rate (sat/vbyte) */
export function btcFeeEstimate(feeRateSatVbyte: number, numInputs: number): number {
  const vbytes = estimateBtcVbytes(numInputs);
  return (vbytes * feeRateSatVbyte) / 1e8;
}

// ─── Ethereum ─────────────────────────────────────────────────────────────────

export interface EthGasPrices {
  /** gwei */
  slow: bigint;
  standard: bigint;
  fast: bigint;
  /** native gas units for a standard ETH transfer */
  gasLimit: bigint;
}

export async function fetchEthGasPrices(): Promise<EthGasPrices> {
  const provider = new ethers.JsonRpcProvider(RPC.ETHEREUM);
  const feeData = await provider.getFeeData();
  const base = feeData.maxFeePerGas ?? feeData.gasPrice ?? ethers.parseUnits('20', 'gwei');

  return {
    slow: (base * 80n) / 100n,
    standard: base,
    fast: (base * 140n) / 100n,
    gasLimit: 21000n, // ETH transfer; ERC-20 is ~65000
  };
}

/**
 * Estimate gas fee in ETH for a transfer.
 * @param isERC20 Uses ~65000 gas instead of 21000
 */
export function ethFeeEstimate(gasPriceWei: bigint, isERC20 = false): number {
  const gasLimit = isERC20 ? 65000n : 21000n;
  const feeWei = gasPriceWei * gasLimit;
  return parseFloat(ethers.formatEther(feeWei));
}

// ─── Solana ───────────────────────────────────────────────────────────────────

/** Solana transaction fee is fixed at ~0.000005 SOL (5000 lamports) */
export const SOL_TX_FEE = 0.000005;
