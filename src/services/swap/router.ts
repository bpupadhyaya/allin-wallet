/**
 * Swap Router
 * -----------
 * Routes swap requests to the appropriate provider:
 *   • Li.Fi  — handles all EVM ↔ EVM and EVM ↔ Solana swaps
 *   • THORChain — handles swaps involving native BTC
 *
 * Private keys are NEVER passed here. This module only builds quotes and
 * unsigned transaction payloads. Signing happens in the wallet layer.
 */

import axios from 'axios';
import { LIFI_API_KEY, THORCHAIN_API } from '../../constants/config';
import { COINS, type CoinSymbol } from '../../constants/coins';

export interface SwapQuote {
  fromCoin: CoinSymbol;
  toCoin: CoinSymbol;
  fromAmount: number;
  toAmount: number;
  /** Human-readable route description, e.g. "1inch → Stargate" */
  route: string;
  estimatedTimeSecs: number;
  fees: Array<{ label: string; amount: number; symbol: string }>;
  /** Price impact as a percentage, e.g. 0.12 means 0.12% */
  priceImpact: number;
  provider: 'lifi' | 'thorchain';
  /** Raw provider response — used later to build the actual tx */
  rawData: unknown;
}

// ─── Chain ID mapping for Li.Fi ─────────────────────────────────────────────
const LIFI_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  solana: 1151111081099710,
};

// ─── THORChain asset string helpers ─────────────────────────────────────────
function toThorAsset(coin: (typeof COINS)[CoinSymbol]): string {
  switch (coin.symbol) {
    case 'BTC':
      return 'BTC.BTC';
    case 'ETH':
      return 'ETH.ETH';
    case 'SOL':
      return 'SOL.SOL';
    case 'USDC_ETH':
      return `ETH.USDC-${coin.contractAddress?.toUpperCase()}`;
    case 'USDT_ETH':
      return `ETH.USDT-${coin.contractAddress?.toUpperCase()}`;
    default:
      // Solana-based tokens — THORChain may not support all; route via Li.Fi
      return coin.symbol;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch the best swap quote for the given pair and amount.
 * Automatically routes to the correct provider.
 * @param slippagePct Slippage tolerance as a percentage, e.g. 0.5 = 0.5% (default)
 */
export async function getSwapQuote(
  fromCoin: CoinSymbol,
  toCoin: CoinSymbol,
  fromAmount: number,
  slippagePct = 0.5,
): Promise<SwapQuote> {
  if (fromAmount <= 0) throw new Error('Amount must be greater than zero');

  const from = COINS[fromCoin];
  const to = COINS[toCoin];

  // BTC always goes through THORChain (native UTXO chain, Li.Fi wraps it)
  if (from.chain === 'bitcoin' || to.chain === 'bitcoin') {
    return getThorchainQuote(fromCoin, toCoin, fromAmount, slippagePct);
  }

  return getLifiQuote(fromCoin, toCoin, fromAmount, slippagePct);
}

// ─── Li.Fi ──────────────────────────────────────────────────────────────────

async function getLifiQuote(
  fromCoin: CoinSymbol,
  toCoin: CoinSymbol,
  fromAmount: number,
  slippagePct = 0.5,
): Promise<SwapQuote> {
  const from = COINS[fromCoin];
  const to = COINS[toCoin];

  const fromChainId = LIFI_CHAIN_ID[from.chain];
  const toChainId = LIFI_CHAIN_ID[to.chain];
  const fromToken = from.isNative ? 'native' : from.contractAddress!;
  const toToken = to.isNative ? 'native' : to.contractAddress!;
  const amountWei = BigInt(
    Math.floor(fromAmount * 10 ** from.decimals),
  ).toString();

  const headers: Record<string, string> = LIFI_API_KEY
    ? { 'x-lifi-api-key': LIFI_API_KEY }
    : {};

  const { data } = await axios.get<{
    estimate: {
      toAmount: string;
      executionDuration: number;
      gasCosts?: Array<{ amountUSD: string }>;
      priceImpact?: string;
    };
    toolDetails?: { name: string };
    includedSteps?: Array<{ toolDetails: { name: string } }>;
  }>('https://li.quest/v1/quote', {
    params: {
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken,
      toToken,
      fromAmount: amountWei,
      slippage: slippagePct / 100,
    },
    headers,
    timeout: 15000,
  });

  const toAmountNum =
    parseFloat(data.estimate.toAmount) / 10 ** to.decimals;
  const gasCostUSD = parseFloat(
    data.estimate.gasCosts?.[0]?.amountUSD ?? '0',
  );
  const routeName =
    data.includedSteps?.map((s) => s.toolDetails.name).join(' → ') ||
    data.toolDetails?.name ||
    'Li.Fi';

  return {
    fromCoin,
    toCoin,
    fromAmount,
    toAmount: toAmountNum,
    route: routeName,
    estimatedTimeSecs: data.estimate.executionDuration || 30,
    fees: [{ label: 'Gas', amount: gasCostUSD, symbol: 'USD' }],
    priceImpact: parseFloat(data.estimate.priceImpact ?? '0') * 100,
    provider: 'lifi',
    rawData: data,
  };
}

// ─── THORChain ───────────────────────────────────────────────────────────────

async function getThorchainQuote(
  fromCoin: CoinSymbol,
  toCoin: CoinSymbol,
  fromAmount: number,
  slippagePct = 0.5,
): Promise<SwapQuote> {
  const from = COINS[fromCoin];
  const to = COINS[toCoin];

  const amountBase = Math.floor(fromAmount * 10 ** from.decimals);

  const { data } = await axios.get<{
    expected_amount_out: string;
    outbound_delay_seconds?: string;
    fees?: { outbound?: string };
    slippage_bps?: string;
    inbound_address?: string;
    memo?: string;
  }>(`${THORCHAIN_API}/thorchain/quote/swap`, {
    params: {
      from_asset: toThorAsset(from),
      to_asset: toThorAsset(to),
      amount: amountBase,
    },
    timeout: 15000,
  });

  const toAmountNum =
    parseInt(data.expected_amount_out ?? '0') / 10 ** to.decimals;
  const outboundFee =
    parseInt(data.fees?.outbound ?? '0') / 10 ** from.decimals;

  return {
    fromCoin,
    toCoin,
    fromAmount,
    toAmount: toAmountNum,
    route: 'THORChain',
    estimatedTimeSecs: parseInt(data.outbound_delay_seconds ?? '600'),
    fees: [{ label: 'Outbound', amount: outboundFee, symbol: from.symbol }],
    priceImpact: parseFloat(data.slippage_bps ?? '0') / 100,
    provider: 'thorchain',
    rawData: data,
  };
}
