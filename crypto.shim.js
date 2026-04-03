/**
 * crypto shim for React Native / Hermes
 *
 * ethers v6 (CJS) does require('crypto') — Node's built-in that doesn't exist
 * in React Native. This shim implements the small surface ethers needs using
 * @noble/hashes (pure-JS, already a transitive dependency of ethers itself).
 */
'use strict';

const { sha256 } = require('@noble/hashes/sha256');
const { sha512 } = require('@noble/hashes/sha512');
const { hmac }   = require('@noble/hashes/hmac');
const { pbkdf2 } = require('@noble/hashes/pbkdf2');

// ── createHash ────────────────────────────────────────────────────────────────
function createHash(algo) {
  let _algo;
  if (algo === 'sha256') _algo = sha256;
  else if (algo === 'sha512') _algo = sha512;
  else throw new Error('crypto shim: unsupported hash: ' + algo);

  const h = _algo.create();
  return {
    update(data) {
      if (typeof data === 'string') data = Buffer.from(data, 'utf8');
      h.update(data);
      return this;
    },
    digest(enc) {
      const result = h.digest();
      return enc === 'hex'
        ? Buffer.from(result).toString('hex')
        : Buffer.from(result);
    },
  };
}

// ── createHmac ────────────────────────────────────────────────────────────────
function createHmac(algo, key) {
  let _algo;
  if (algo === 'sha256') _algo = sha256;
  else if (algo === 'sha512') _algo = sha512;
  else throw new Error('crypto shim: unsupported hmac algo: ' + algo);

  if (typeof key === 'string') key = Buffer.from(key, 'utf8');
  const h = hmac.create(_algo, key);
  return {
    update(data) {
      if (typeof data === 'string') data = Buffer.from(data, 'utf8');
      h.update(data);
      return this;
    },
    digest(enc) {
      const result = h.digest();
      return enc === 'hex'
        ? Buffer.from(result).toString('hex')
        : Buffer.from(result);
    },
  };
}

// ── pbkdf2Sync ────────────────────────────────────────────────────────────────
function pbkdf2Sync(password, salt, iterations, keylen, algo) {
  let _algo;
  if (algo === 'sha256') _algo = sha256;
  else if (algo === 'sha512') _algo = sha512;
  else throw new Error('crypto shim: unsupported pbkdf2 algo: ' + algo);

  if (typeof password === 'string') password = Buffer.from(password, 'utf8');
  if (typeof salt === 'string') salt = Buffer.from(salt, 'utf8');
  return Buffer.from(pbkdf2(_algo, password, salt, { c: iterations, dkLen: keylen }));
}

// ── randomBytes ───────────────────────────────────────────────────────────────
function randomBytes(size) {
  const arr = new Uint8Array(size);
  // react-native-get-random-values patches global.crypto.getRandomValues
  if (global.crypto && global.crypto.getRandomValues) {
    global.crypto.getRandomValues(arr);
  } else {
    throw new Error('crypto shim: getRandomValues not available');
  }
  return Buffer.from(arr);
}

module.exports = { createHash, createHmac, pbkdf2Sync, randomBytes };
