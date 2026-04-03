// This file MUST use CommonJS require() - never import - so it runs synchronously
// before any ES module crypto code is evaluated.
'use strict';

// Buffer polyfill (required by bcryptjs, @solana/web3.js, ethers, @scure/*)
const { Buffer } = require('buffer');
if (!global.Buffer) {
  global.Buffer = Buffer;
}
