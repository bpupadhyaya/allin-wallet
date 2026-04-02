// ---------------------------------------------------------------------------
// App configuration
// Keys prefixed with EXPO_PUBLIC_ are safe for bundle inclusion (non-secret
// config like RPC endpoints). Private API keys must stay server-side.
// ---------------------------------------------------------------------------

/** True in Metro dev builds; false in production EAS builds. */
export const IS_DEV = __DEV__;

// RPC endpoints — replace with paid/dedicated endpoints before mainnet launch.
export const RPC = {
  ETHEREUM:
    process.env.EXPO_PUBLIC_ETH_RPC || 'https://eth.llamarpc.com',
  SOLANA:
    process.env.EXPO_PUBLIC_SOL_RPC ||
    'https://api.mainnet-beta.solana.com',
  BITCOIN_API:
    process.env.EXPO_PUBLIC_BTC_API || 'https://mempool.space/api',
};

// Li.Fi — cross-chain swap aggregator (ETH ↔ SOL and all EVM bridges).
export const LIFI_API_KEY = process.env.EXPO_PUBLIC_LIFI_API_KEY || '';

// THORChain — used for native BTC swaps.
export const THORCHAIN_API = 'https://thornode.ninerealms.com';

// WalletConnect v2 — register at https://cloud.walletconnect.com
export const WC_PROJECT_ID = process.env.EXPO_PUBLIC_WC_PROJECT_ID || '';

// ─── Dev / Test shortcuts (NEVER shipped in production builds) ───────────────
// These are BIP-39 all-zeros test vectors — they have no real funds.
export const DEV_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
export const DEV_USERNAME = 'devuser';
export const DEV_PASSWORD = 'DevPass123!';
export const DEV_PIN = '123456';

// Security parameters
export const BCRYPT_ROUNDS_PASSWORD = 12;
export const BCRYPT_ROUNDS_PIN = 10;
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const APP_VERSION = '1.0.0';
