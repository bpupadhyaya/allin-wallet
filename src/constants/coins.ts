export type CoinSymbol =
  | 'BTC'
  | 'ETH'
  | 'SOL'
  | 'USDC_SOL'
  | 'USDT_SOL'
  | 'USDC_ETH'
  | 'USDT_ETH';

export type ChainId = 'bitcoin' | 'ethereum' | 'solana';

export interface CoinConfig {
  symbol: CoinSymbol;
  name: string;
  chain: ChainId;
  decimals: number;
  isNative: boolean;
  contractAddress?: string;
  /** Li.Fi chain ID (undefined for Bitcoin which uses Thorchain) */
  lifiChainId?: number;
  color: string;
  /** Emoji/symbol icon for display */
  icon: string;
}

export const COINS: Record<CoinSymbol, CoinConfig> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    chain: 'bitcoin',
    decimals: 8,
    isNative: true,
    color: '#F7931A',
    icon: '₿',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    chain: 'ethereum',
    decimals: 18,
    isNative: true,
    lifiChainId: 1,
    color: '#627EEA',
    icon: 'Ξ',
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    chain: 'solana',
    decimals: 9,
    isNative: true,
    lifiChainId: 1151111081099710,
    color: '#9945FF',
    icon: '◎',
  },
  USDC_SOL: {
    symbol: 'USDC_SOL',
    name: 'USDC (Solana)',
    chain: 'solana',
    decimals: 6,
    isNative: false,
    contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    lifiChainId: 1151111081099710,
    color: '#2775CA',
    icon: '$',
  },
  USDT_SOL: {
    symbol: 'USDT_SOL',
    name: 'USDT (Solana)',
    chain: 'solana',
    decimals: 6,
    isNative: false,
    contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    lifiChainId: 1151111081099710,
    color: '#26A17B',
    icon: '₮',
  },
  USDC_ETH: {
    symbol: 'USDC_ETH',
    name: 'USDC (Ethereum)',
    chain: 'ethereum',
    decimals: 6,
    isNative: false,
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    lifiChainId: 1,
    color: '#2775CA',
    icon: '$',
  },
  USDT_ETH: {
    symbol: 'USDT_ETH',
    name: 'USDT (Ethereum)',
    chain: 'ethereum',
    decimals: 6,
    isNative: false,
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    lifiChainId: 1,
    color: '#26A17B',
    icon: '₮',
  },
};

export const COIN_LIST = Object.values(COINS);
