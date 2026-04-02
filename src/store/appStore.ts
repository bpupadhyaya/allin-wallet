import { create } from 'zustand';
import type { Balances } from '../services/balance';
import { ZERO_BALANCES } from '../services/balance';
import type { Prices } from '../services/prices';
import { ZERO_PRICES } from '../services/prices';
import type { WalletType, WalletAddresses } from '../services/storage';
import type { SwapResult } from '../services/swap/executor';
import type { CoinSymbol } from '../constants/coins';

export interface TxRecord {
  id: string;
  fromCoin: CoinSymbol;
  toCoin: CoinSymbol;
  fromAmount: number;
  toAmount: number;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  explorerUrl: string;
  timestamp: number;
  route: string;
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
  /** Last confirmed/pending swap transactions (most recent first) */
  recentTxs: TxRecord[];

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
    set((s) => ({ recentTxs: [tx, ...s.recentTxs].slice(0, 50) })),

  logout: () =>
    set({
      isAuthenticated: false,
      username: null,
      pendingMnemonic: null,
      pendingSagaPubkey: null,
    }),
}));
