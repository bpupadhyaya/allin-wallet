import { HDKey } from '@scure/bip32';
import * as btcSigner from '@scure/btc-signer';
import { Keypair, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { bech32 } from 'bech32';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { blake2b } from '@noble/hashes/blake2b';
import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { mnemonicToSeed } from './mnemonic';
import { isTestnet } from '../constants/config';
import { createHmac } from 'crypto';

/** Zero-fill a Buffer or Uint8Array to prevent sensitive data lingering in memory. */
function wipe(buf: Uint8Array | Buffer): void {
  buf.fill(0);
}

export interface DerivedWallets {
  btc: { address: string; publicKey: string };
  eth: { address: string; publicKey: string };
  sol: { address: string; publicKey: string };
  ada: { address: string; publicKey: string };
  doge: { address: string; publicKey: string };
  xrp: { address: string; publicKey: string };
  dot: { address: string; publicKey: string };
  pol: { address: string; publicKey: string };
}

// BIP-44 derivation paths
function getBtcPath(): string {
  return isTestnet() ? "m/84'/1'/0'/0/0" : "m/84'/0'/0'/0/0";
}
const PATHS = {
  ETH: "m/44'/60'/0'/0/0",
  SOL: "m/44'/501'/0'/0'",
  DOGE: "m/44'/3'/0'/0/0",
  XRP: "m/44'/144'/0'/0/0",
  DOT: "m/44'/354'/0'/0/0",
  POL: "m/44'/60'/0'/0/0", // Same as ETH (EVM-compatible)
};

// DOGE network params for @scure/btc-signer (P2PKH, no SegWit)
const DOGE_NETWORK = {
  bech32: '',
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

// ─── XRP address encoding ─────────────────────────────────────────────────
const XRP_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
function xrpBase58Encode(data: Uint8Array): string {
  // XRP uses its own Base58 alphabet
  const base58Chars = XRP_ALPHABET;
  let num = BigInt(0);
  for (const byte of data) num = num * 256n + BigInt(byte);
  let result = '';
  while (num > 0n) {
    result = base58Chars[Number(num % 58n)] + result;
    num = num / 58n;
  }
  for (const byte of data) {
    if (byte !== 0) break;
    result = base58Chars[0] + result;
  }
  return result;
}

function deriveXrpAddress(publicKey: Uint8Array): string {
  const pubHash = ripemd160(sha256(publicKey));
  // Version byte 0x00 + 20-byte hash + 4-byte checksum
  const payload = new Uint8Array(21);
  payload[0] = 0x00;
  payload.set(pubHash, 1);
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const full = new Uint8Array(25);
  full.set(payload);
  full.set(checksum, 21);
  return xrpBase58Encode(full);
}

// ─── Cardano address derivation (simplified Shelley enterprise address) ───
// Uses SLIP-10 ed25519 derivation for the spending key
function deriveCardanoAddress(seed: Uint8Array): { address: string; publicKey: string } {
  // SLIP-10 ed25519 master key derivation
  let I = createHmac('sha512', 'ed25519 seed').update(seed).digest();
  let il = I.slice(0, 32);
  let ir = I.slice(32);
  // Derive m/1852'/1815'/0'/0/0 (CIP-1852 Shelley)
  const indices = [
    1852 + 0x80000000,
    1815 + 0x80000000,
    0 + 0x80000000,
    0,
    0,
  ];
  for (const idx of indices) {
    const buf = Buffer.alloc(37);
    buf[0] = 0;
    Buffer.from(il).copy(buf, 1);
    buf.writeUInt32BE(idx, 33);
    const I2 = createHmac('sha512', ir).update(buf).digest();
    il = I2.slice(0, 32);
    ir = I2.slice(32);
  }
  const pub = ed25519.getPublicKey(il);
  // Enterprise address (type 6): header byte 0x61 (mainnet) or 0x60 (testnet)
  // + blake2b-224 of public key
  const pubHash = blake2b(pub, { dkLen: 28 });
  const headerByte = isTestnet() ? 0x60 : 0x61;
  const addrBytes = new Uint8Array(1 + 28);
  addrBytes[0] = headerByte;
  addrBytes.set(pubHash, 1);
  const prefix = isTestnet() ? 'addr_test' : 'addr';
  const words = bech32.toWords(addrBytes);
  // Cardano uses bech32 (not bech32m) for addresses
  const address = bech32.encode(prefix, words, 200);
  return { address, publicKey: Buffer.from(pub).toString('hex') };
}

// ─── Polkadot address (SS58 encoding) ──────────────────────────────────────
function deriveDotAddress(seed: Uint8Array): { address: string; publicKey: string } {
  // Use SLIP-10 ed25519 for DOT key derivation
  let I = createHmac('sha512', 'ed25519 seed').update(seed).digest();
  let il = I.slice(0, 32);
  let ir = I.slice(32);
  const indices = [44 + 0x80000000, 354 + 0x80000000, 0 + 0x80000000, 0 + 0x80000000];
  for (const idx of indices) {
    const buf = Buffer.alloc(37);
    buf[0] = 0;
    Buffer.from(il).copy(buf, 1);
    buf.writeUInt32BE(idx, 33);
    const I2 = createHmac('sha512', ir).update(buf).digest();
    il = I2.slice(0, 32);
    ir = I2.slice(32);
  }
  const pub = ed25519.getPublicKey(il);
  // SS58 encoding: prefix 0x00 (Polkadot) + 32-byte public key + 2-byte checksum
  const SS58_PREFIX = new TextEncoder().encode('SS58PRE');
  const prefixByte = 0; // Polkadot network
  const payload = new Uint8Array(1 + 32);
  payload[0] = prefixByte;
  payload.set(pub, 1);
  const hashInput = new Uint8Array(SS58_PREFIX.length + payload.length);
  hashInput.set(SS58_PREFIX);
  hashInput.set(payload, SS58_PREFIX.length);
  const hash = blake2b(hashInput, { dkLen: 64 });
  const checksum = hash.slice(0, 2);
  const full = new Uint8Array(payload.length + 2);
  full.set(payload);
  full.set(checksum, payload.length);
  // Base58 encode (standard Bitcoin alphabet for SS58)
  const bs58 = require('bs58');
  const address = bs58.default.encode(full);
  return { address, publicKey: Buffer.from(pub).toString('hex') };
}

/** Get the BTC network constant for @scure/btc-signer */
export function getBtcNetwork() {
  return isTestnet() ? btcSigner.TEST_NETWORK : btcSigner.NETWORK;
}

export async function deriveWalletsFromMnemonic(
  mnemonic: string,
): Promise<DerivedWallets> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);

  // ── Bitcoin (Native SegWit P2WPKH) ────────────��────────────────────────
  const btcKey = root.derive(getBtcPath());
  const btcPubKey = btcKey.publicKey!;
  const btcAddress = btcSigner.p2wpkh(btcPubKey, getBtcNetwork()).address!;

  // ── Ethereum ─────────────���──────────────────────────────��───────────────
  const ethKey = root.derive(PATHS.ETH);
  const ethPrivBytes = Buffer.from(ethKey.privateKey!);
  const ethPriv = '0x' + ethPrivBytes.toString('hex');
  const ethWallet = new ethers.Wallet(ethPriv);
  wipe(ethPrivBytes);

  // ── Solana (ed25519 via slip10 derivation) ──────────────────────────────
  const solKey = root.derive(PATHS.SOL);
  const solKeypair = Keypair.fromSeed(solKey.privateKey!.slice(0, 32));

  // ── Cardano (SLIP-10 ed25519, CIP-1852 Shelley) ──────────────────────
  const ada = deriveCardanoAddress(seed);

  // ── Dogecoin (P2PKH, secp256k1) ──────────────────────────────────────
  const dogeKey = root.derive(PATHS.DOGE);
  const dogePubKey = dogeKey.publicKey!;
  const dogeAddress = btcSigner.p2pkh(dogePubKey, DOGE_NETWORK).address!;

  // ── XRP (secp256k1, custom base58) ───────────────────────────────────
  const xrpKey = root.derive(PATHS.XRP);
  const xrpPubKey = xrpKey.publicKey!;
  const xrpAddress = deriveXrpAddress(xrpPubKey);

  // ── Polkadot (SLIP-10 ed25519, SS58) ─────────────────────────────────
  const dot = deriveDotAddress(seed);

  // ── Polygon (EVM, same derivation as ETH) ────────────────────────────
  // POL uses the same address as ETH since it's EVM-compatible
  const polAddress = ethWallet.address;

  // Wipe the master seed now that all derivations are done
  wipe(seed);

  return {
    btc: {
      address: btcAddress,
      publicKey: Buffer.from(btcPubKey).toString('hex'),
    },
    eth: {
      address: ethWallet.address,
      publicKey: ethWallet.signingKey.publicKey,
    },
    sol: {
      address: solKeypair.publicKey.toBase58(),
      publicKey: solKeypair.publicKey.toBase58(),
    },
    ada: {
      address: ada.address,
      publicKey: ada.publicKey,
    },
    doge: {
      address: dogeAddress,
      publicKey: Buffer.from(dogePubKey).toString('hex'),
    },
    xrp: {
      address: xrpAddress,
      publicKey: Buffer.from(xrpPubKey).toString('hex'),
    },
    dot: {
      address: dot.address,
      publicKey: dot.publicKey,
    },
    pol: {
      address: polAddress,
      publicKey: ethWallet.signingKey.publicKey,
    },
  };
}

/** Derives ETH private key — only called when signing a transaction. */
export async function getEthSigner(
  mnemonic: string,
  rpcUrl: string,
): Promise<ethers.Wallet> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const ethKey = root.derive(PATHS.ETH);
  const privBytes = Buffer.from(ethKey.privateKey!);
  const priv = '0x' + privBytes.toString('hex');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(priv, provider);
  wipe(privBytes);
  wipe(seed);
  return wallet;
}

/** Derives Solana Keypair — only called when signing a transaction. */
export async function getSolKeypair(mnemonic: string): Promise<Keypair> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const solKey = root.derive(PATHS.SOL);
  const keypair = Keypair.fromSeed(solKey.privateKey!.slice(0, 32));
  wipe(seed);
  return keypair;
}

/** Derives BTC private key — only called when signing a transaction. */
export async function getBtcPrivateKey(mnemonic: string): Promise<Uint8Array> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const btcKey = root.derive(getBtcPath());
  const privKey = Uint8Array.from(btcKey.privateKey!);
  wipe(seed);
  return privKey;
}

/**
 * Returns both the private key and the compressed (33-byte) public key for
 * BTC P2WPKH signing.  HDKey.publicKey is already compressed — this is the
 * correct input for btcSigner.p2wpkh().
 */
export async function getBtcKeyPair(
  mnemonic: string,
): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const btcKey = root.derive(getBtcPath());
  const result = {
    privateKey: Uint8Array.from(btcKey.privateKey!),
    publicKey: Uint8Array.from(btcKey.publicKey!),
  };
  wipe(seed);
  return result;
}

/**
 * Derive a wallet struct from a Solana Seeker/Saga public key.
 * In this case BTC and ETH are not available via the phone key — only SOL.
 */
export function walletsFromSagaPublicKey(pubkeyBase58: string): DerivedWallets {
  return {
    btc: { address: '', publicKey: '' },
    eth: { address: '', publicKey: '' },
    sol: { address: pubkeyBase58, publicKey: pubkeyBase58 },
    ada: { address: '', publicKey: '' },
    doge: { address: '', publicKey: '' },
    xrp: { address: '', publicKey: '' },
    dot: { address: '', publicKey: '' },
    pol: { address: '', publicKey: '' },
  };
}

/** Derives DOGE private+public key pair for P2PKH signing. */
export async function getDogeKeyPair(
  mnemonic: string,
): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const dogeKey = root.derive(PATHS.DOGE);
  const result = {
    privateKey: Uint8Array.from(dogeKey.privateKey!),
    publicKey: Uint8Array.from(dogeKey.publicKey!),
  };
  wipe(seed);
  return result;
}

export function getDogeNetwork() {
  return DOGE_NETWORK;
}

/** Derives XRP private key for signing. */
export async function getXrpKeyPair(
  mnemonic: string,
): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const xrpKey = root.derive(PATHS.XRP);
  const result = {
    privateKey: Uint8Array.from(xrpKey.privateKey!),
    publicKey: Uint8Array.from(xrpKey.publicKey!),
  };
  wipe(seed);
  return result;
}

/** Derives Polygon signer (same as ETH, different RPC). */
export async function getPolSigner(
  mnemonic: string,
  rpcUrl: string,
): Promise<ethers.Wallet> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const key = root.derive(PATHS.POL);
  const privBytes = Buffer.from(key.privateKey!);
  const priv = '0x' + privBytes.toString('hex');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(priv, provider);
  wipe(privBytes);
  wipe(seed);
  return wallet;
}
