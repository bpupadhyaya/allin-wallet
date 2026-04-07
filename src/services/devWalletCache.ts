/**
 * Practice Wallet Cache & Usage Tracking
 * ----------------------------------------
 * Caches fully-created practice wallet state so switching is instant.
 * Tracks usage milestones for the practice-to-production graduation flow.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CACHE_PREFIX = 'dev_wallet_cache_';
const CREATED_KEY = 'dev_wallets_created';
const USAGE_KEY = 'practice_wallet_usage';
const HIDDEN_KEY = 'practice_wallets_hidden';

export interface CachedWallet {
  id: string;
  username: string;
  mnemonic: string;
  passwordHash: string;
  pinHash: string;
  walletType: string;
  addresses: Record<string, string>;
}

// Usage tracking for graduation requirements
export interface PracticeUsage {
  walletsCreated: string[];    // IDs of wallets created
  walletsLoggedIn: string[];   // IDs logged into
  walletsSwitched: string[];   // IDs switched to (from another)
  walletsTransacted: string[]; // IDs with at least one transaction
}

const EMPTY_USAGE: PracticeUsage = {
  walletsCreated: [],
  walletsLoggedIn: [],
  walletsSwitched: [],
  walletsTransacted: [],
};

// ─── Cache ────────────────────────────────────────────────────────────────────

export async function cacheDevWallet(wallet: CachedWallet): Promise<void> {
  await AsyncStorage.setItem(CACHE_PREFIX + wallet.id, JSON.stringify(wallet));
  const created = await getCreatedDevWalletIds();
  if (!created.includes(wallet.id)) {
    created.push(wallet.id);
    await AsyncStorage.setItem(CREATED_KEY, JSON.stringify(created));
  }
  await trackUsage('walletsCreated', wallet.id);
}

export async function loadCachedDevWallet(id: string): Promise<CachedWallet | null> {
  const raw = await AsyncStorage.getItem(CACHE_PREFIX + id);
  if (!raw) return null;
  return JSON.parse(raw) as CachedWallet;
}

export async function getCreatedDevWalletIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CREATED_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

export async function restoreCachedWallet(cached: CachedWallet): Promise<void> {
  // Validate cache integrity before restoring
  if (!cached.mnemonic) throw new Error('Cache corrupted: missing mnemonic');
  if (!cached.username) throw new Error('Cache corrupted: missing username');
  if (!cached.passwordHash) throw new Error('Cache corrupted: missing password hash');
  if (!cached.pinHash) throw new Error('Cache corrupted: missing PIN hash');
  if (!cached.addresses) throw new Error('Cache corrupted: missing addresses');

  const SO = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  // Write sequentially to avoid partial state on failure
  await SecureStore.setItemAsync('wallet_mnemonic_v1', cached.mnemonic, SO);
  await SecureStore.setItemAsync('wallet_username_v1', cached.username, SO);
  await SecureStore.setItemAsync('wallet_pw_hash_v1', cached.passwordHash, SO);
  await SecureStore.setItemAsync('wallet_pin_hash_v1', cached.pinHash, SO);
  await AsyncStorage.setItem('wallet_type_v1', cached.walletType);
  await AsyncStorage.setItem(
    'wallet_addresses_v1',
    typeof cached.addresses === 'string' ? cached.addresses : JSON.stringify(cached.addresses),
  );
}

export async function deleteCachedDevWallet(id: string): Promise<void> {
  await AsyncStorage.removeItem(CACHE_PREFIX + id);
  const created = await getCreatedDevWalletIds();
  const updated = created.filter((w) => w !== id);
  await AsyncStorage.setItem(CREATED_KEY, JSON.stringify(updated));
}

export async function clearAllDevWalletCaches(): Promise<void> {
  const created = await getCreatedDevWalletIds();
  await Promise.all(created.map((id) => AsyncStorage.removeItem(CACHE_PREFIX + id)));
  await AsyncStorage.removeItem(CREATED_KEY);
  await AsyncStorage.removeItem(USAGE_KEY);
}

// ─── Usage Tracking ───────────────────────────────────────────────────────────

export async function getUsage(): Promise<PracticeUsage> {
  const raw = await AsyncStorage.getItem(USAGE_KEY);
  if (!raw) return { ...EMPTY_USAGE };
  return JSON.parse(raw) as PracticeUsage;
}

async function trackUsage(field: keyof PracticeUsage, id: string): Promise<void> {
  const usage = await getUsage();
  if (!usage[field].includes(id)) {
    usage[field].push(id);
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  }
}

export async function trackLogin(id: string): Promise<void> {
  await trackUsage('walletsLoggedIn', id);
}

export async function trackSwitch(id: string): Promise<void> {
  await trackUsage('walletsSwitched', id);
}

export async function trackTransaction(id: string): Promise<void> {
  await trackUsage('walletsTransacted', id);
}

/** Check if user has met all graduation requirements to hide practice wallets */
export async function canHidePracticeWallets(): Promise<boolean> {
  const usage = await getUsage();
  return (
    usage.walletsCreated.length >= 3 &&
    usage.walletsLoggedIn.length >= 3 &&
    usage.walletsSwitched.length >= 2 &&
    usage.walletsTransacted.length >= 1
  );
}

// ─── Visibility Toggle ───────────────────────────────────────────────────────

export async function setPracticeWalletsHidden(hidden: boolean): Promise<void> {
  await AsyncStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0');
}

export async function arePracticeWalletsHidden(): Promise<boolean> {
  const v = await AsyncStorage.getItem(HIDDEN_KEY);
  return v === '1';
}
