/**
 * Transaction History
 * -------------------
 * Persistent storage for swap + send records in AsyncStorage.
 * The Zustand store holds the in-memory view; this module provides
 * load/save to survive app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TxRecord } from '../store/appStore';

const KEY = 'wallet_tx_history_v1';
const MAX_RECORDS = 100;

export async function saveTxRecord(record: TxRecord): Promise<void> {
  const existing = await loadTxHistory();
  const updated = [record, ...existing].slice(0, MAX_RECORDS);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}

export async function loadTxHistory(): Promise<TxRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TxRecord[];
  } catch {
    return [];
  }
}

export async function updateTxRecord(
  txHash: string,
  updates: Partial<TxRecord>,
): Promise<void> {
  try {
    const existing = await loadTxHistory();
    const updated = existing.map((r) =>
      r.txHash === txHash ? { ...r, ...updates } : r,
    );
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Non-critical — swallow so callers don't need to handle it
  }
}

export async function clearTxHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
