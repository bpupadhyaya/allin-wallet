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
};

const RPC_TESTNET = {
  ETHEREUM: 'https://rpc.sepolia.org',
  SOLANA: 'https://api.devnet.solana.com',
  BITCOIN_API: 'https://mempool.space/testnet4/api',
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
  chain: 'bitcoin' | 'ethereum' | 'solana',
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
  // solana
  return _testnet
    ? `https://solscan.io/tx/${txHash}?cluster=devnet`
    : `https://solscan.io/tx/${txHash}`;
}

// ─── Dev / Test shortcuts (NEVER shipped in production builds) ───────────────
// These are BIP-39 all-zeros test vectors — they have no real funds.
export const DEV_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
export const DEV_USERNAME = 'devuser';

// Pre-derived addresses for DEV_MNEMONIC
const DEV_ADDRESSES_MAINNET = {
  btc: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
  eth: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  sol: '4nFZgXtZAEwbfA56LRVRdsDGNeW3U55gr5hL9c5E5de5',
};
// BTC testnet uses coin type 1 → different address; ETH/SOL are network-agnostic
const DEV_ADDRESSES_TESTNET = {
  btc: 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl',
  eth: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  sol: '4nFZgXtZAEwbfA56LRVRdsDGNeW3U55gr5hL9c5E5de5',
};

export function getDevAddresses() {
  return _testnet ? DEV_ADDRESSES_TESTNET : DEV_ADDRESSES_MAINNET;
}
/** @deprecated Use getDevAddresses() */
export const DEV_ADDRESSES = DEV_ADDRESSES_MAINNET;

export const DEV_PASSWORD = 'DevPass123!';
export const DEV_PIN = '123456';

// Security parameters
export const BCRYPT_ROUNDS_PASSWORD = 12;
export const BCRYPT_ROUNDS_PIN = 10;
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const APP_VERSION = '1.0.0';
