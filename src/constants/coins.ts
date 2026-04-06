import { isTestnet } from './config';

export type CoinSymbol =
  | 'BTC'
  | 'ETH'
  | 'SOL'
  | 'ADA'
  | 'DOGE'
  | 'XRP'
  | 'DOT'
  | 'LINK'
  | 'POL'
  | 'JUP'
  | 'USDC_SOL'
  | 'USDT_SOL'
  | 'USDC_ETH'
  | 'USDT_ETH';

export type ChainId = 'bitcoin' | 'ethereum' | 'solana' | 'cardano' | 'dogecoin' | 'xrp' | 'polkadot' | 'polygon';

export interface CoinConfig {
  symbol: CoinSymbol;
  name: string;
  chain: ChainId;
  decimals: number;
  isNative: boolean;
  contractAddress?: string;
  /** Testnet contract address (if different from mainnet) */
  testnetContractAddress?: string;
  /** Li.Fi chain ID (undefined for Bitcoin which uses Thorchain) */
  lifiChainId?: number;
  /** Li.Fi testnet chain ID (e.g. Sepolia) */
  testnetLifiChainId?: number;
  color: string;
  /** Emoji/symbol icon for display */
  icon: string;
}

/** Get the active contract address (mainnet or testnet) */
export function getContractAddress(coin: CoinConfig): string | undefined {
  if (isTestnet() && coin.testnetContractAddress) return coin.testnetContractAddress;
  return coin.contractAddress;
}

/** Get the active Li.Fi chain ID */
export function getLifiChainId(coin: CoinConfig): number | undefined {
  if (isTestnet() && coin.testnetLifiChainId) return coin.testnetLifiChainId;
  return coin.lifiChainId;
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
    testnetLifiChainId: 11155111, // Sepolia
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
    testnetContractAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
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
    testnetContractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // no official devnet USDT
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
    testnetContractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle Sepolia USDC
    lifiChainId: 1,
    testnetLifiChainId: 11155111, // Sepolia
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
    testnetContractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // no official Sepolia USDT
    lifiChainId: 1,
    testnetLifiChainId: 11155111,
    color: '#26A17B',
    icon: '₮',
  },
  ADA: {
    symbol: 'ADA',
    name: 'Cardano',
    chain: 'cardano',
    decimals: 6,
    isNative: true,
    color: '#0033AD',
    icon: '₳',
  },
  DOGE: {
    symbol: 'DOGE',
    name: 'Dogecoin',
    chain: 'dogecoin',
    decimals: 8,
    isNative: true,
    color: '#C2A633',
    icon: 'Ð',
  },
  XRP: {
    symbol: 'XRP',
    name: 'XRP',
    chain: 'xrp',
    decimals: 6,
    isNative: true,
    color: '#23292F',
    icon: '✕',
  },
  DOT: {
    symbol: 'DOT',
    name: 'Polkadot',
    chain: 'polkadot',
    decimals: 10,
    isNative: true,
    color: '#E6007A',
    icon: '●',
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink',
    chain: 'ethereum',
    decimals: 18,
    isNative: false,
    contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    testnetContractAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    lifiChainId: 1,
    testnetLifiChainId: 11155111,
    color: '#2A5ADA',
    icon: '⬡',
  },
  POL: {
    symbol: 'POL',
    name: 'Polygon',
    chain: 'polygon',
    decimals: 18,
    isNative: true,
    lifiChainId: 137,
    testnetLifiChainId: 80002, // Amoy testnet
    color: '#8247E5',
    icon: '⬟',
  },
  JUP: {
    symbol: 'JUP',
    name: 'Jupiter',
    chain: 'solana',
    decimals: 6,
    isNative: false,
    contractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    lifiChainId: 1151111081099710,
    color: '#2BD67B',
    icon: '♃',
  },
};

export const COIN_LIST = Object.values(COINS);
