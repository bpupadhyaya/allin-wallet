import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bcrypt from 'bcryptjs';
import {
  BCRYPT_ROUNDS_PASSWORD,
  BCRYPT_ROUNDS_PIN,
} from '../constants/config';
import type { DisplayScales } from '../constants/theme';

// ─── Key names ──────────────────────────────────────────────────────────────
const K = {
  MNEMONIC: 'wallet_mnemonic_v1',
  USERNAME: 'wallet_username_v1',
  PASSWORD_HASH: 'wallet_pw_hash_v1',
  PIN_HASH: 'wallet_pin_hash_v1',
  WALLET_TYPE: 'wallet_type_v1',
  ADDRESSES: 'wallet_addresses_v1',
  SAGA_PUBKEY: 'wallet_saga_pubkey_v1',
  TESTNET_ENABLED: 'wallet_testnet_v1',
  DISPLAY_SCALES: 'display_scales_v1',
} as const;

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// ─── Mnemonic (most sensitive — OS-encrypted keychain/keystore) ─────────────

export async function saveMnemonic(mnemonic: string): Promise<void> {
  await SecureStore.setItemAsync(K.MNEMONIC, mnemonic, SECURE_OPTS);
}

export async function getMnemonic(): Promise<string | null> {
  return SecureStore.getItemAsync(K.MNEMONIC);
}

export async function deleteMnemonic(): Promise<void> {
  await SecureStore.deleteItemAsync(K.MNEMONIC);
}

// ─── Credentials ────────────────────────────────────────────────────────────

export async function saveCredentials(
  username: string,
  password: string,
): Promise<void> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS_PASSWORD);
  await SecureStore.setItemAsync(K.USERNAME, username, SECURE_OPTS);
  await SecureStore.setItemAsync(K.PASSWORD_HASH, hash, SECURE_OPTS);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(K.PASSWORD_HASH);
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function getUsername(): Promise<string | null> {
  return SecureStore.getItemAsync(K.USERNAME);
}

// ─── PIN ────────────────────────────────────────────────────────────────────

export async function savePin(pin: string): Promise<void> {
  const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS_PIN);
  await SecureStore.setItemAsync(K.PIN_HASH, hash, SECURE_OPTS);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(K.PIN_HASH);
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export async function hasPin(): Promise<boolean> {
  const h = await SecureStore.getItemAsync(K.PIN_HASH);
  return h !== null;
}

// ─── Wallet type + addresses (non-sensitive, AsyncStorage) ──────────────────

export type WalletType = 'seed' | 'saga';

export interface WalletAddresses {
  btc: string;
  eth: string;
  sol: string;
  ada: string;
  doge: string;
  xrp: string;
  dot: string;
  pol: string;
}

export async function saveWalletType(type: WalletType): Promise<void> {
  await AsyncStorage.setItem(K.WALLET_TYPE, type);
}

export async function getWalletType(): Promise<WalletType | null> {
  const v = await AsyncStorage.getItem(K.WALLET_TYPE);
  return v as WalletType | null;
}

export async function saveWalletAddresses(a: WalletAddresses): Promise<void> {
  await AsyncStorage.setItem(K.ADDRESSES, JSON.stringify(a));
}

export async function getWalletAddresses(): Promise<WalletAddresses | null> {
  const v = await AsyncStorage.getItem(K.ADDRESSES);
  return v ? (JSON.parse(v) as WalletAddresses) : null;
}

export async function saveSagaPubkey(pubkey: string): Promise<void> {
  await SecureStore.setItemAsync(K.SAGA_PUBKEY, pubkey, SECURE_OPTS);
}

export async function getSagaPubkey(): Promise<string | null> {
  return SecureStore.getItemAsync(K.SAGA_PUBKEY);
}

// ─── Testnet preference (non-sensitive, AsyncStorage) ─────────────────────

export async function saveTestnetEnabled(v: boolean): Promise<void> {
  await AsyncStorage.setItem(K.TESTNET_ENABLED, v ? 'true' : 'false');
}

export async function getTestnetEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(K.TESTNET_ENABLED);
  return v === 'true';
}

// ─── Display scales (non-sensitive, AsyncStorage) ─────────────────────────

export async function saveDisplayScales(scales: DisplayScales): Promise<void> {
  await AsyncStorage.setItem(K.DISPLAY_SCALES, JSON.stringify(scales));
}

export async function getDisplayScales(): Promise<DisplayScales | null> {
  const v = await AsyncStorage.getItem(K.DISPLAY_SCALES);
  return v ? (JSON.parse(v) as DisplayScales) : null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function hasWallet(): Promise<boolean> {
  const type = await getWalletType();
  return type !== null;
}

/** Wipes ALL wallet data — irreversible. */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(K.MNEMONIC),
    SecureStore.deleteItemAsync(K.USERNAME),
    SecureStore.deleteItemAsync(K.PASSWORD_HASH),
    SecureStore.deleteItemAsync(K.PIN_HASH),
    SecureStore.deleteItemAsync(K.SAGA_PUBKEY),
    AsyncStorage.removeItem(K.WALLET_TYPE),
    AsyncStorage.removeItem(K.ADDRESSES),
  ]);
}
