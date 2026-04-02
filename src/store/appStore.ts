import { create } from 'zustand';
import type { Balances } from '../services/balance';
import { ZERO_BALANCES } from '../services/balance';
import type { Prices } from '../services/prices';
import { ZERO_PRICES } from '../services/prices';
import type { WalletType, WalletAddresses } from '../services/storage';
import type { CoinSymbol } from '../constants/coins';

export interface TxRecord {
  id: string;
  /** 'swap' = cross-coin swap; 'send' = wallet-to-address transfer */
  type: 'swap' | 'send';
  fromCoin: CoinSymbol;
  /** For sends, equals fromCoin */
  toCoin: CoinSymbol;
  fromAmount: number;
  /** For sends, equals fromAmount (minus fee) */
  toAmount: number;
  /** Recipient address — only set for sends */
  toAddress?: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  explorerUrl: string;
  timestamp: number;
  /** Swap route description, e.g. "1inch → Stargate" */
  route?: string;
  /** Fee in native coin of the sending chain */
  feeCoin?: string;
  feeAmount?: number;
}

interface AppState {
  // ── Auth ──────────────────────────────────────────────────────────────────
  isAuthenticated: boolean;
  username: string | null;
  hasWallet: boolean;
  walletType: WalletType | null;

  // ── Onboarding (in-memory only) ───────────────────────────────────────────
  pendingMnemonic: string | null;
  pendingSagaPubkey: string | null;

  // ── Wallet data ───────────────────────────────────────────────────────────
  addresses: WalletAddresses | null;
  balances: Balances;
  balancesLoading: boolean;
  prices: Prices;
  pricesLoading: boolean;

  // ── Transaction history (in-memory; persisted separately in AsyncStorage) ─
  recentTxs: TxRecord[];

  // ── User preferences ──────────────────────────────────────────────────────
  /** Swap slippage percentage, e.g. 0.5 means 0.5% */
  slippagePct: number;
  biometricEnabled: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  setAuthenticated: (val: boolean, username?: string) => void;
  setHasWallet: (val: boolean, type?: WalletType) => void;
  setPendingMnemonic: (m: string | null) => void;
  setPendingSagaPubkey: (pk: string | null) => void;
  setAddresses: (a: WalletAddresses) => void;
  setBalances: (b: Balances) => void;
  setBalancesLoading: (v: boolean) => void;
  setPrices: (p: Prices) => void;
  setPricesLoading: (v: boolean) => void;
  addTxRecord: (tx: TxRecord) => void;
  setRecentTxs: (txs: TxRecord[]) => void;
  setSlippage: (pct: number) => void;
  setBiometricEnabled: (v: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isAuthenticated: false,
  username: null,
  hasWallet: false,
  walletType: null,
  pendingMnemonic: null,
  pendingSagaPubkey: null,
  addresses: null,
  balances: ZERO_BALANCES,
  balancesLoading: false,
  prices: ZERO_PRICES,
  pricesLoading: false,
  recentTxs: [],
  slippagePct: 0.5,
  biometricEnabled: false,

  setAuthenticated: (val, username) =>
    set({ isAuthenticated: val, username: username ?? null }),

  setHasWallet: (val, type) =>
    set({ hasWallet: val, walletType: type ?? null }),

  setPendingMnemonic: (m) => set({ pendingMnemonic: m }),
  setPendingSagaPubkey: (pk) => set({ pendingSagaPubkey: pk }),
  setAddresses: (a) => set({ addresses: a }),
  setBalances: (b) => set({ balances: b }),
  setBalancesLoading: (v) => set({ balancesLoading: v }),
  setPrices: (p) => set({ prices: p }),
  setPricesLoading: (v) => set({ pricesLoading: v }),

  addTxRecord: (tx) =>
    set((s) => ({ recentTxs: [tx, ...s.recentTxs].slice(0, 100) })),

  setRecentTxs: (txs) => set({ recentTxs: txs }),
  setSlippage: (pct) => set({ slippagePct: pct }),
  setBiometricEnabled: (v) => set({ biometricEnabled: v }),

  logout: () =>
    set({
      isAuthenticated: false,
      username: null,
      pendingMnemonic: null,
      pendingSagaPubkey: null,
    }),
}));
