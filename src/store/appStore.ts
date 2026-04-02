import { create } from 'zustand';
import type { Balances } from '../services/balance';
import { ZERO_BALANCES } from '../services/balance';
import type { WalletType, WalletAddresses } from '../services/storage';

interface AppState {
  // ── Auth ──────────────────────────────────────────────────────────────────
  isAuthenticated: boolean;
  username: string | null;
  hasWallet: boolean;
  walletType: WalletType | null;

  // ── Onboarding (in-memory only — never persisted beyond the setup flow) ───
  pendingMnemonic: string | null;
  pendingSagaPubkey: string | null;

  // ── Wallet data ───────────────────────────────────────────────────────────
  addresses: WalletAddresses | null;
  balances: Balances;
  balancesLoading: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  setAuthenticated: (val: boolean, username?: string) => void;
  setHasWallet: (val: boolean, type?: WalletType) => void;
  setPendingMnemonic: (m: string | null) => void;
  setPendingSagaPubkey: (pk: string | null) => void;
  setAddresses: (a: WalletAddresses) => void;
  setBalances: (b: Balances) => void;
  setBalancesLoading: (v: boolean) => void;
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

  setAuthenticated: (val, username) =>
    set({ isAuthenticated: val, username: username ?? null }),

  setHasWallet: (val, type) =>
    set({ hasWallet: val, walletType: type ?? null }),

  setPendingMnemonic: (m) => set({ pendingMnemonic: m }),
  setPendingSagaPubkey: (pk) => set({ pendingSagaPubkey: pk }),
  setAddresses: (a) => set({ addresses: a }),
  setBalances: (b) => set({ balances: b }),
  setBalancesLoading: (v) => set({ balancesLoading: v }),

  logout: () =>
    set({
      isAuthenticated: false,
      username: null,
      pendingMnemonic: null,
      pendingSagaPubkey: null,
    }),
}));
