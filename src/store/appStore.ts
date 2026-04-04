import { create } from 'zustand';
import type { Balances } from '../services/balance';
import { ZERO_BALANCES } from '../services/balance';
import type { Prices, PriceChanges } from '../services/prices';
import { ZERO_PRICES, ZERO_CHANGES } from '../services/prices';
import type { WalletType, WalletAddresses } from '../services/storage';
import type { CoinSymbol } from '../constants/coins';
import { setTestnetMode } from '../constants/config';
import type { DisplayScales } from '../constants/theme';
import { saveDisplayScales } from '../services/storage';

export interface TxRecord {
  id: string;
  type: 'swap' | 'send';
  fromCoin: CoinSymbol;
  toCoin: CoinSymbol;
  fromAmount: number;
  toAmount: number;
  toAddress?: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  explorerUrl: string;
  timestamp: number;
  route?: string;
  feeCoin?: string;
  feeAmount?: number;
}

export interface WcSession {
  topic: string;
  peerName: string;
  peerUrl: string;
  peerIcon?: string;
  chains: string[];
  connectedAt: number;
}

export interface WcRequest {
  id: number;
  topic: string;
  method: string;
  params: unknown;
  peerName: string;
  peerIcon?: string;
}

interface AppState {
  // ── Auth ──────────────────────────────────────────────────────────────────
  isAuthenticated: boolean;
  isLocked: boolean;
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
  priceChanges: PriceChanges;
  pricesLoading: boolean;

  // ── Transaction history ───────────────────────────────────────────────────
  recentTxs: TxRecord[];

  // ── WalletConnect ─────────────────────────────────────────────────────────
  wcSessions: WcSession[];
  wcPendingRequest: WcRequest | null;
  wcInitialized: boolean;

  // ── User preferences ──────────────────────────────────────────────────────
  slippagePct: number;
  biometricEnabled: boolean;
  useTestnet: boolean;

  // ── Display scaling ────────────────────────────────────────────────────────
  appFontScale: number;
  contentFontScale: number;
  navFontScale: number;
  uiElementScale: number;

  // ── Actions ───────────────────────────────────────────────────────────────
  setAuthenticated: (val: boolean, username?: string) => void;
  setHasWallet: (val: boolean, type?: WalletType) => void;
  setPendingMnemonic: (m: string | null) => void;
  setPendingSagaPubkey: (pk: string | null) => void;
  setAddresses: (a: WalletAddresses) => void;
  setBalances: (b: Balances) => void;
  setBalancesLoading: (v: boolean) => void;
  setPrices: (p: Prices) => void;
  setPriceChanges: (c: PriceChanges) => void;
  setPricesLoading: (v: boolean) => void;
  addTxRecord: (tx: TxRecord) => void;
  setRecentTxs: (txs: TxRecord[]) => void;
  updateTxStatus: (txHash: string, status: TxRecord['status']) => void;
  setWcSessions: (sessions: WcSession[]) => void;
  addWcSession: (s: WcSession) => void;
  removeWcSession: (topic: string) => void;
  setWcPendingRequest: (req: WcRequest | null) => void;
  setWcInitialized: (v: boolean) => void;
  setSlippage: (pct: number) => void;
  setBiometricEnabled: (v: boolean) => void;
  setUseTestnet: (v: boolean) => void;
  setAppFontScale: (v: number) => void;
  setContentFontScale: (v: number) => void;
  setNavFontScale: (v: number) => void;
  setUiElementScale: (v: number) => void;
  setDisplayScales: (s: DisplayScales) => void;
  lock: () => void;
  unlock: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isAuthenticated: false,
  isLocked: false,
  username: null,
  hasWallet: false,
  walletType: null,
  pendingMnemonic: null,
  pendingSagaPubkey: null,
  addresses: null,
  balances: ZERO_BALANCES,
  balancesLoading: false,
  prices: ZERO_PRICES,
  priceChanges: ZERO_CHANGES,
  pricesLoading: false,
  recentTxs: [],
  wcSessions: [],
  wcPendingRequest: null,
  wcInitialized: false,
  slippagePct: 0.5,
  biometricEnabled: false,
  useTestnet: false,
  appFontScale: 1.0,
  contentFontScale: 1.0,
  navFontScale: 1.0,
  uiElementScale: 1.0,

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
  setPriceChanges: (c) => set({ priceChanges: c }),
  setPricesLoading: (v) => set({ pricesLoading: v }),
  addTxRecord: (tx) =>
    set((s) => ({ recentTxs: [tx, ...s.recentTxs].slice(0, 100) })),
  setRecentTxs: (txs) => set({ recentTxs: txs }),
  updateTxStatus: (txHash, status) =>
    set((s) => ({
      recentTxs: s.recentTxs.map((r) =>
        r.txHash === txHash ? { ...r, status } : r,
      ),
    })),
  setWcSessions: (sessions) => set({ wcSessions: sessions }),
  addWcSession: (s) =>
    set((state) => ({ wcSessions: [...state.wcSessions, s] })),
  removeWcSession: (topic) =>
    set((state) => ({ wcSessions: state.wcSessions.filter((s) => s.topic !== topic) })),
  setWcPendingRequest: (req) => set({ wcPendingRequest: req }),
  setWcInitialized: (v) => set({ wcInitialized: v }),
  setSlippage: (pct) => set({ slippagePct: pct }),
  setBiometricEnabled: (v) => set({ biometricEnabled: v }),
  setUseTestnet: (v) => {
    setTestnetMode(v);
    set({ useTestnet: v });
  },
  setAppFontScale: (v) => set((s) => {
    const scales = { appFontScale: v, contentFontScale: s.contentFontScale, navFontScale: s.navFontScale, uiElementScale: s.uiElementScale };
    saveDisplayScales(scales).catch(() => {});
    return { appFontScale: v };
  }),
  setContentFontScale: (v) => set((s) => {
    const scales = { appFontScale: s.appFontScale, contentFontScale: v, navFontScale: s.navFontScale, uiElementScale: s.uiElementScale };
    saveDisplayScales(scales).catch(() => {});
    return { contentFontScale: v };
  }),
  setNavFontScale: (v) => set((s) => {
    const scales = { appFontScale: s.appFontScale, contentFontScale: s.contentFontScale, navFontScale: v, uiElementScale: s.uiElementScale };
    saveDisplayScales(scales).catch(() => {});
    return { navFontScale: v };
  }),
  setUiElementScale: (v) => set((s) => {
    const scales = { appFontScale: s.appFontScale, contentFontScale: s.contentFontScale, navFontScale: s.navFontScale, uiElementScale: v };
    saveDisplayScales(scales).catch(() => {});
    return { uiElementScale: v };
  }),
  setDisplayScales: (s) => set({
    appFontScale: s.appFontScale,
    contentFontScale: s.contentFontScale,
    navFontScale: s.navFontScale,
    uiElementScale: s.uiElementScale,
  }),
  lock: () => set({ isLocked: true }),
  unlock: () => set({ isLocked: false }),
  logout: () =>
    set({
      isAuthenticated: false,
      isLocked: false,
      username: null,
      pendingMnemonic: null,
      pendingSagaPubkey: null,
      wcPendingRequest: null,
    }),
}));
