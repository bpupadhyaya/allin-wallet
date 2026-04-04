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
import { LIFI_API_KEY, getThorchainApi } from '../../constants/config';
import { COINS, type CoinSymbol, getLifiChainId, getContractAddress } from '../../constants/coins';

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

// ─── Chain ID mapping for Li.Fi (now derived from coin config) ──────────────

// ─── THORChain supported pairs ──────────────────────────────────────────────
// THORChain supports native assets and major ERC-20s, but NOT Solana SPL tokens.
const THORCHAIN_SUPPORTED: Set<CoinSymbol> = new Set([
  'BTC', 'ETH', 'SOL', 'USDC_ETH', 'USDT_ETH',
]);

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
      return `ETH.USDC-${coin.contractAddress!.toUpperCase()}`;
    case 'USDT_ETH':
      return `ETH.USDT-${coin.contractAddress!.toUpperCase()}`;
    case 'USDC_SOL':
      // THORChain Solana USDC: SOL.USDC-<mint address>
      return `SOL.USDC-${coin.contractAddress}`;
    case 'USDT_SOL':
      // THORChain Solana USDT: SOL.USDT-<mint address>
      return `SOL.USDT-${coin.contractAddress}`;
    default:
      return coin.symbol;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch the best swap quote for the given pair and amount.
 * Automatically routes to the correct provider.
 *
 * @param slippagePct Slippage tolerance as a percentage, e.g. 0.5 = 0.5%
 * @param destinationAddress The user's receiving address on the target chain.
 *   Required for THORChain routes — it is embedded in the swap memo so
 *   THORChain knows where to send the output.
 */
export async function getSwapQuote(
  fromCoin: CoinSymbol,
  toCoin: CoinSymbol,
  fromAmount: number,
  slippagePct = 0.5,
  destinationAddress?: string,
): Promise<SwapQuote> {
  if (fromAmount <= 0) throw new Error('Amount must be greater than zero');

  const from = COINS[fromCoin];
  const to = COINS[toCoin];

  // BTC always goes through THORChain (native UTXO chain, Li.Fi wraps it)
  if (from.chain === 'bitcoin' || to.chain === 'bitcoin') {
    return getThorchainQuote(
      fromCoin,
      toCoin,
      fromAmount,
      slippagePct,
      destinationAddress,
    );
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

  const fromChainId = getLifiChainId(from);
  const toChainId = getLifiChainId(to);
  const fromToken = from.isNative ? 'native' : getContractAddress(from)!;
  const toToken = to.isNative ? 'native' : getContractAddress(to)!;
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
      approvalAddress?: string;
      gasCosts?: Array<{ amountUSD: string }>;
      priceImpact?: string;
    };
    action: {
      fromToken: { address: string; decimals: number };
      fromAmount: string;
    };
    toolDetails?: { name: string };
    includedSteps?: Array<{ toolDetails: { name: string } }>;
    transactionRequest?: {
      to: string;
      data: string;
      value?: string;
      gasLimit?: string;
    };
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
  destinationAddress?: string,
): Promise<SwapQuote> {
  const from = COINS[fromCoin];
  const to = COINS[toCoin];

  // THORChain doesn't support Solana SPL tokens (USDC_SOL, USDT_SOL) as
  // source or destination. Guide the user to do a two-step swap instead.
  if (!THORCHAIN_SUPPORTED.has(fromCoin) || !THORCHAIN_SUPPORTED.has(toCoin)) {
    const unsupported = !THORCHAIN_SUPPORTED.has(toCoin) ? toCoin : fromCoin;
    const nativeIntermediate = COINS[unsupported].chain === 'solana' ? 'SOL' : 'ETH';
    throw new Error(
      `THORChain does not support ${unsupported.replace('_', ' ')} directly. ` +
      `Try swapping BTC → ${nativeIntermediate} first, then ${nativeIntermediate} → ${unsupported.replace('_', ' ')}.`,
    );
  }

  if (!destinationAddress) {
    throw new Error(
      'A destination address is required for THORChain swaps. ' +
      'Please ensure your wallet is fully loaded before swapping.',
    );
  }

  const amountBase = Math.floor(fromAmount * 10 ** from.decimals);

  let data: {
    expected_amount_out: string;
    outbound_delay_seconds?: string;
    fees?: { outbound?: string };
    slippage_bps?: string;
    inbound_address?: string;
    memo?: string;
  };

  try {
    const resp = await axios.get<typeof data>(
      `${getThorchainApi()}/thorchain/quote/swap`,
      {
        params: {
          from_asset: toThorAsset(from),
          to_asset: toThorAsset(to),
          amount: amountBase,
          destination: destinationAddress,
          slippage_bps: Math.round(slippagePct * 100),
        },
        timeout: 15000,
      },
    );
    data = resp.data;
  } catch (err: unknown) {
    // Extract THORChain's error message from the 400 response if available
    const axiosErr = err as { response?: { data?: { message?: string } } };
    const thorMsg = axiosErr.response?.data?.message;
    if (thorMsg) {
      throw new Error(
        `THORChain: ${thorMsg}. This pair may not be supported — ` +
        `try swapping to a native asset (SOL, ETH) first.`,
      );
    }
    throw err;
  }

  if (!data.inbound_address || !data.memo) {
    throw new Error(
      'THORChain returned an incomplete quote (missing inbound_address or memo). ' +
      'The trading pair may not be supported. Try a different pair.',
    );
  }

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
