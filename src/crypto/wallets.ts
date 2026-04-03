import { HDKey } from '@scure/bip32';
import * as btcSigner from '@scure/btc-signer';
import { Keypair, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { mnemonicToSeed } from './mnemonic';

export interface DerivedWallets {
  btc: { address: string; publicKey: string };
  eth: { address: string; publicKey: string };
  sol: { address: string; publicKey: string };
}

// BIP-44 derivation paths
const PATHS = {
  /** Native SegWit (bech32 P2WPKH) — lowest fees, modern standard */
  BTC: "m/84'/0'/0'/0/0",
  ETH: "m/44'/60'/0'/0/0",
  /** Solana uses ed25519; @scure/bip32 supports it via slip10 */
  SOL: "m/44'/501'/0'/0'",
};

export async function deriveWalletsFromMnemonic(
  mnemonic: string,
): Promise<DerivedWallets> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);

  // ── Bitcoin (Native SegWit P2WPKH) ─────────────────────────────────────
  const btcKey = root.derive(PATHS.BTC);
  const btcPubKey = btcKey.publicKey!;
  const btcAddress = btcSigner.p2wpkh(btcPubKey, btcSigner.NETWORK).address!;

  // ── Ethereum ────────────────────────────────────────────────────────────
  const ethKey = root.derive(PATHS.ETH);
  const ethPriv = '0x' + Buffer.from(ethKey.privateKey!).toString('hex');
  const ethWallet = new ethers.Wallet(ethPriv);

  // ── Solana (ed25519 via slip10 derivation) ──────────────────────────────
  const solKey = root.derive(PATHS.SOL);
  const solKeypair = Keypair.fromSeed(solKey.privateKey!.slice(0, 32));

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
  const priv = '0x' + Buffer.from(ethKey.privateKey!).toString('hex');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(priv, provider);
}

/** Derives Solana Keypair — only called when signing a transaction. */
export async function getSolKeypair(mnemonic: string): Promise<Keypair> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const solKey = root.derive(PATHS.SOL);
  return Keypair.fromSeed(solKey.privateKey!.slice(0, 32));
}

/** Derives BTC private key — only called when signing a transaction. */
export async function getBtcPrivateKey(mnemonic: string): Promise<Uint8Array> {
  const seed = await mnemonicToSeed(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const btcKey = root.derive(PATHS.BTC);
  return btcKey.privateKey!;
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
  const btcKey = root.derive(PATHS.BTC);
  return {
    privateKey: btcKey.privateKey!,
    publicKey: btcKey.publicKey!, // compressed 33-byte secp256k1 key
  };
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
  };
}
