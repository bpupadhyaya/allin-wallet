// ---------------------------------------------------------------------------
// App configuration
// Keys prefixed with EXPO_PUBLIC_ are safe for bundle inclusion (non-secret
// config like RPC endpoints). Private API keys must stay server-side.
// ---------------------------------------------------------------------------

/** True in Metro dev builds; false in production EAS builds. */
export const IS_DEV = __DEV__;

// ─── Testnet toggle ─────────────────────────────────────────────────────────
let _testnet = false;

export function setTestnetMode(v: boolean) {
  _testnet = v;
}
export function isTestnet(): boolean {
  return _testnet;
}

// ─── RPC endpoints ──────────────────────────────────────────────────────────

const RPC_MAINNET = {
  ETHEREUM: process.env.EXPO_PUBLIC_ETH_RPC || 'https://eth.llamarpc.com',
  SOLANA: process.env.EXPO_PUBLIC_SOL_RPC || 'https://api.mainnet-beta.solana.com',
  BITCOIN_API: process.env.EXPO_PUBLIC_BTC_API || 'https://mempool.space/api',
  CARDANO_API: 'https://cardano-mainnet.blockfrost.io/api/v0',
  DOGECOIN_API: 'https://dogechain.info/api/v1',
  XRP_RPC: 'https://xrplcluster.com',
  POLKADOT_RPC: 'https://rpc.polkadot.io',
  POLYGON_RPC: 'https://polygon-rpc.com',
};

const RPC_TESTNET = {
  ETHEREUM: 'https://rpc.sepolia.org',
  SOLANA: 'https://api.devnet.solana.com',
  BITCOIN_API: 'https://mempool.space/testnet4/api',
  CARDANO_API: 'https://cardano-preprod.blockfrost.io/api/v0',
  DOGECOIN_API: 'https://dogechain.info/api/v1',
  XRP_RPC: 'https://s.altnet.rippletest.net:51234',
  POLKADOT_RPC: 'https://westend-rpc.polkadot.io',
  POLYGON_RPC: 'https://rpc-amoy.polygon.technology',
};

/** @deprecated Use getRpc() for testnet-aware endpoints */
export const RPC = RPC_MAINNET;

export function getRpc() {
  return _testnet ? RPC_TESTNET : RPC_MAINNET;
}

// Li.Fi — cross-chain swap aggregator (ETH ↔ SOL and all EVM bridges).
export const LIFI_API_KEY = process.env.EXPO_PUBLIC_LIFI_API_KEY || '';

// THORChain — used for native BTC swaps.
const THORCHAIN_MAINNET = 'https://thornode.ninerealms.com';
const THORCHAIN_TESTNET = 'https://stagenet-thornode.ninerealms.com';

/** @deprecated Use getThorchainApi() */
export const THORCHAIN_API = THORCHAIN_MAINNET;

export function getThorchainApi(): string {
  return _testnet ? THORCHAIN_TESTNET : THORCHAIN_MAINNET;
}

// WalletConnect v2 — register at https://cloud.walletconnect.com
export const WC_PROJECT_ID = process.env.EXPO_PUBLIC_WC_PROJECT_ID || '';

// ─── Explorer URLs ──────────────────────────────────────────────────────────

export function getExplorerTxUrl(
  chain: string,
  txHash: string,
): string {
  if (chain === 'bitcoin') {
    return _testnet
      ? `https://mempool.space/testnet4/tx/${txHash}`
      : `https://mempool.space/tx/${txHash}`;
  }
  if (chain === 'ethereum') {
    return _testnet
      ? `https://sepolia.etherscan.io/tx/${txHash}`
      : `https://etherscan.io/tx/${txHash}`;
  }
  if (chain === 'cardano') {
    return _testnet
      ? `https://preprod.cardanoscan.io/transaction/${txHash}`
      : `https://cardanoscan.io/transaction/${txHash}`;
  }
  if (chain === 'dogecoin') {
    return `https://dogechain.info/tx/${txHash}`;
  }
  if (chain === 'xrp') {
    return _testnet
      ? `https://testnet.xrpl.org/transactions/${txHash}`
      : `https://xrpscan.com/tx/${txHash}`;
  }
  if (chain === 'polkadot') {
    return `https://polkadot.subscan.io/extrinsic/${txHash}`;
  }
  if (chain === 'polygon') {
    return _testnet
      ? `https://amoy.polygonscan.com/tx/${txHash}`
      : `https://polygonscan.com/tx/${txHash}`;
  }
  // solana
  return _testnet
    ? `https://solscan.io/tx/${txHash}?cluster=devnet`
    : `https://solscan.io/tx/${txHash}`;
}

// ─── Dev / Test shortcuts ────────────────────────────────────────────────────
// Loaded from .env.development (gitignored). Empty in production builds.
export const DEV_MNEMONIC = __DEV__ ? (process.env.EXPO_PUBLIC_DEV_MNEMONIC || '') : '';
export const DEV_USERNAME = __DEV__ ? (process.env.EXPO_PUBLIC_DEV_USERNAME || '') : '';
export const DEV_PASSWORD = __DEV__ ? (process.env.EXPO_PUBLIC_DEV_PASSWORD || '') : '';
export const DEV_PIN = __DEV__ ? (process.env.EXPO_PUBLIC_DEV_PIN || '') : '';

const DEV_ADDRESSES_MAINNET = {
  btc: process.env.EXPO_PUBLIC_DEV_BTC || '',
  eth: process.env.EXPO_PUBLIC_DEV_ETH || '',
  sol: process.env.EXPO_PUBLIC_DEV_SOL || '',
  ada: process.env.EXPO_PUBLIC_DEV_ADA || '',
  doge: process.env.EXPO_PUBLIC_DEV_DOGE || '',
  xrp: process.env.EXPO_PUBLIC_DEV_XRP || '',
  dot: process.env.EXPO_PUBLIC_DEV_DOT || '',
  pol: process.env.EXPO_PUBLIC_DEV_POL || '',
};
const DEV_ADDRESSES_TESTNET = {
  btc: process.env.EXPO_PUBLIC_DEV_BTC_TEST || '',
  eth: process.env.EXPO_PUBLIC_DEV_ETH || '',
  sol: process.env.EXPO_PUBLIC_DEV_SOL || '',
  ada: process.env.EXPO_PUBLIC_DEV_ADA_TEST || '',
  doge: process.env.EXPO_PUBLIC_DEV_DOGE || '',
  xrp: process.env.EXPO_PUBLIC_DEV_XRP || '',
  dot: process.env.EXPO_PUBLIC_DEV_DOT || '',
  pol: process.env.EXPO_PUBLIC_DEV_POL || '',
};

export function getDevAddresses() {
  return _testnet ? DEV_ADDRESSES_TESTNET : DEV_ADDRESSES_MAINNET;
}
/** @deprecated Use getDevAddresses() */
export const DEV_ADDRESSES = DEV_ADDRESSES_MAINNET;

// Security parameters
export const BCRYPT_ROUNDS_PASSWORD = 12;
export const BCRYPT_ROUNDS_PIN = 10;
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const APP_VERSION = '1.0.0';
