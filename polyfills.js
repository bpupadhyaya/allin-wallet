// This file MUST use CommonJS require() - never import - so it runs synchronously
// before any ES module crypto code is evaluated.
'use strict';

// Buffer polyfill (required by bcryptjs, @solana/web3.js, ethers, @scure/*)
const { Buffer } = require('buffer');
if (!global.Buffer) {
  global.Buffer = Buffer;
}

// React Native runs on-device and is inherently a secure context.
// The MWA browser stub checks window.isSecureContext which doesn't exist in RN.
if (typeof window !== 'undefined' && window.isSecureContext === undefined) {
  window.isSecureContext = true;
}

// crypto.subtle polyfill — required by @solana-mobile MWA browser stub for
// ECDH key exchange and AES-GCM session encryption.
// NOTE: react-native-get-random-values must be loaded BEFORE this file
// so that global.crypto.getRandomValues is already set.
const cryptoShim = require('./crypto-subtle-shim');
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.subtle) {
  global.crypto.subtle = cryptoShim.subtle;
}
// Ensure getRandomValues is available on the same crypto object
if (!global.crypto.getRandomValues && typeof crypto !== 'undefined' && crypto.getRandomValues) {
  global.crypto.getRandomValues = crypto.getRandomValues.bind(crypto);
}
