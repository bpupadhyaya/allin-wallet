/**
 * Price Service
 * -------------
 * Fetches USD spot prices + 24h % change from CoinGecko's free public API.
 */
import axios from 'axios';
import type { CoinSymbol } from '../constants/coins';

export type Prices = Record<CoinSymbol, number>;
export type PriceChanges = Record<CoinSymbol, number>;

export const ZERO_PRICES: Prices = {
  BTC: 0, ETH: 0, SOL: 0,
  USDC_SOL: 1, USDT_SOL: 1,
  USDC_ETH: 1, USDT_ETH: 1,
};
export const ZERO_CHANGES: PriceChanges = {
  BTC: 0, ETH: 0, SOL: 0,
  USDC_SOL: 0, USDT_SOL: 0,
  USDC_ETH: 0, USDT_ETH: 0,
};

const COINGECKO_IDS: Record<string, CoinSymbol[]> = {
  bitcoin:   ['BTC'],
  ethereum:  ['ETH'],
  solana:    ['SOL'],
  'usd-coin': ['USDC_SOL', 'USDC_ETH'],
  tether:    ['USDT_SOL', 'USDT_ETH'],
};

const CG_URL =
  'https://api.coingecko.com/api/v3/simple/price' +
  '?ids=bitcoin,ethereum,solana,usd-coin,tether' +
  '&vs_currencies=usd&include_24hr_change=true';

export interface PriceFetchResult {
  prices: Prices;
  changes: PriceChanges;
}

export async function fetchPrices(): Promise<PriceFetchResult> {
  const { data } = await axios.get<
    Record<string, { usd: number; usd_24h_change?: number }>
  >(CG_URL, { timeout: 8000 });

  const prices = { ...ZERO_PRICES };
  const changes = { ...ZERO_CHANGES };

  for (const [cgId, symbols] of Object.entries(COINGECKO_IDS)) {
    const entry = data[cgId];
    if (!entry) continue;
    for (const sym of symbols) {
      prices[sym] = entry.usd ?? 0;
      changes[sym] = entry.usd_24h_change ?? 0;
    }
  }

  return { prices, changes };
}

export function toUsd(amount: number, price: number): number {
  return amount * price;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return usd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

/** Format a 24h % change for display, e.g. "+3.42%" or "-1.08%" */
export function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** Returns true if a stablecoin deviates > 0.5% from $1 (de-peg alert). */
export function isDepeggedStable(symbol: CoinSymbol, price: number): boolean {
  const stables: CoinSymbol[] = ['USDC_SOL', 'USDT_SOL', 'USDC_ETH', 'USDT_ETH'];
  return stables.includes(symbol) && Math.abs(price - 1) > 0.005;
}
