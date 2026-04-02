/**
 * Price Service
 * -------------
 * Fetches USD spot prices from CoinGecko's free public API.
 * Prices are cached in-memory; callers should refresh every 60s at most.
 *
 * USDC and USDT are stable — we still fetch them to catch de-peg events
 * and surface a warning if either deviates > 0.5% from $1.
 */
import axios from 'axios';
import type { CoinSymbol } from '../constants/coins';

export type Prices = Record<CoinSymbol, number>;

export const ZERO_PRICES: Prices = {
  BTC: 0,
  ETH: 0,
  SOL: 0,
  USDC_SOL: 1,
  USDT_SOL: 1,
  USDC_ETH: 1,
  USDT_ETH: 1,
};

const COINGECKO_IDS: Record<string, CoinSymbol[]> = {
  bitcoin: ['BTC'],
  ethereum: ['ETH'],
  solana: ['SOL'],
  'usd-coin': ['USDC_SOL', 'USDC_ETH'],
  tether: ['USDT_SOL', 'USDT_ETH'],
};

const CG_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,usd-coin,tether&vs_currencies=usd';

export async function fetchPrices(): Promise<Prices> {
  const { data } = await axios.get<Record<string, { usd: number }>>(CG_URL, {
    timeout: 8000,
  });

  const prices = { ...ZERO_PRICES };

  for (const [cgId, symbols] of Object.entries(COINGECKO_IDS)) {
    const usd = data[cgId]?.usd;
    if (usd != null) {
      for (const sym of symbols) {
        prices[sym] = usd;
      }
    }
  }

  return prices;
}

/** Returns USD value for a given coin balance. */
export function toUsd(amount: number, price: number): number {
  return amount * price;
}

/** Formats a USD value for display, e.g. 1234567.89 → "$1,234,567.89" */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return usd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

/** Returns true if a stablecoin price deviates > 0.5% from $1 (de-peg alert). */
export function isDepeggedStable(symbol: CoinSymbol, price: number): boolean {
  const stables: CoinSymbol[] = ['USDC_SOL', 'USDT_SOL', 'USDC_ETH', 'USDT_ETH'];
  if (!stables.includes(symbol)) return false;
  return Math.abs(price - 1) > 0.005;
}
