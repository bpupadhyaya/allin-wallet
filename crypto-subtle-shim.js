/**
 * Minimal crypto.subtle shim for React Native.
 *
 * Provides just enough WebCrypto API for the Solana Mobile Wallet Adapter
 * browser stub (ECDH P-256 key exchange + AES-128-GCM session encryption).
 *
 * Uses @noble/curves for ECDH and @noble/ciphers for AES-GCM.
 */
'use strict';

const { p256 } = require('@noble/curves/p256');

// AES-GCM via @noble/ciphers (already a transitive dep of @scure/bip39)
let gcm, randomBytes;
try {
  gcm = require('@noble/ciphers/aes').gcm;
  randomBytes = require('@noble/ciphers/webcrypto').randomBytes;
} catch {
  // Fallback: use crypto.getRandomValues from react-native-get-random-values
  randomBytes = (n) => {
    const buf = new Uint8Array(n);
    global.crypto.getRandomValues(buf);
    return buf;
  };
}

// Internal key storage (WeakMap keyed by opaque CryptoKey objects)
const keyStore = new WeakMap();

function makeCryptoKey(type, algorithm, extractable, usages, data) {
  const key = Object.freeze({ type, algorithm, extractable, usages: Object.freeze(usages) });
  keyStore.set(key, data);
  return key;
}

const subtle = {
  async generateKey(algorithm, extractable, keyUsages) {
    if (algorithm.name === 'ECDSA' || algorithm.name === 'ECDH') {
      const privBytes = p256.utils.randomPrivateKey();
      const pubBytes = p256.getPublicKey(privBytes, false); // uncompressed
      const pub = makeCryptoKey('public', algorithm, true, [], { raw: pubBytes });
      const priv = makeCryptoKey('private', algorithm, extractable, keyUsages, {
        raw: privBytes,
        publicRaw: pubBytes,
      });
      return { publicKey: pub, privateKey: priv };
    }
    if (algorithm.name === 'AES-GCM') {
      const raw = randomBytes(algorithm.length / 8);
      return makeCryptoKey('secret', algorithm, extractable, keyUsages, { raw });
    }
    throw new Error(`generateKey: unsupported algorithm ${algorithm.name}`);
  },

  async exportKey(format, key) {
    const data = keyStore.get(key);
    if (!data) throw new Error('exportKey: unknown key');
    if (format === 'raw') {
      if (key.type === 'public') return data.raw.buffer.slice(0);
      if (key.type === 'secret') return data.raw.buffer.slice(0);
      throw new Error('exportKey: cannot export private key as raw');
    }
    throw new Error(`exportKey: unsupported format ${format}`);
  },

  async importKey(format, keyData, algorithm, extractable, keyUsages) {
    if (format !== 'raw') throw new Error(`importKey: unsupported format ${format}`);
    const raw = new Uint8Array(keyData);
    const type = algorithm.name === 'AES-GCM' ? 'secret' : 'public';
    return makeCryptoKey(type, algorithm, extractable, keyUsages, { raw });
  },

  async deriveBits(algorithm, baseKey, length) {
    if (algorithm.name !== 'ECDH') throw new Error('deriveBits: only ECDH supported');
    const privData = keyStore.get(baseKey);
    const pubData = keyStore.get(algorithm.public);
    if (!privData || !pubData) throw new Error('deriveBits: unknown key');
    const shared = p256.getSharedSecret(privData.raw, pubData.raw, false);
    // shared is 65 bytes (uncompressed 0x04 || x || y); skip prefix
    // WebCrypto deriveBits returns `length` bits of the x-coordinate
    const xBytes = shared.slice(1, 1 + 32);
    const bits = length / 8;
    return xBytes.slice(0, bits).buffer;
  },

  async deriveKey(algorithm, baseKey, derivedKeyAlgorithm, extractable, keyUsages) {
    const bits = await this.deriveBits(algorithm, baseKey, derivedKeyAlgorithm.length);
    const raw = new Uint8Array(bits);
    return makeCryptoKey('secret', derivedKeyAlgorithm, extractable, keyUsages, { raw });
  },

  async encrypt(algorithm, key, data) {
    if (algorithm.name !== 'AES-GCM') throw new Error('encrypt: only AES-GCM supported');
    const keyData = keyStore.get(key);
    if (!keyData) throw new Error('encrypt: unknown key');
    const iv = new Uint8Array(algorithm.iv);
    const plaintext = new Uint8Array(data);
    const aes = gcm(keyData.raw, iv);
    const ciphertext = aes.encrypt(plaintext);
    return ciphertext.buffer;
  },

  async decrypt(algorithm, key, data) {
    if (algorithm.name !== 'AES-GCM') throw new Error('decrypt: only AES-GCM supported');
    const keyData = keyStore.get(key);
    if (!keyData) throw new Error('decrypt: unknown key');
    const iv = new Uint8Array(algorithm.iv);
    const ciphertext = new Uint8Array(data);
    const aes = gcm(keyData.raw, iv);
    const plaintext = aes.decrypt(ciphertext);
    return plaintext.buffer;
  },

  async sign(algorithm, key, data) {
    if (algorithm.name !== 'ECDSA') throw new Error('sign: only ECDSA supported');
    const keyData = keyStore.get(key);
    if (!keyData) throw new Error('sign: unknown key');
    const msg = new Uint8Array(data);
    const sig = p256.sign(msg, keyData.raw, { lowS: true });
    return sig.toDERRawBytes().buffer;
  },

  async verify(algorithm, key, signature, data) {
    if (algorithm.name !== 'ECDSA') throw new Error('verify: only ECDSA supported');
    const keyData = keyStore.get(key);
    if (!keyData) throw new Error('verify: unknown key');
    return p256.verify(new Uint8Array(signature), new Uint8Array(data), keyData.raw);
  },
};

module.exports = { subtle };
