// Custom entry point — polyfills MUST be required before expo-router
// so Buffer is available when bcryptjs / @solana/web3.js / ethers initialize.
// react-native-get-random-values MUST load before polyfills because the
// crypto.subtle shim needs crypto.getRandomValues for key generation.
require('react-native-get-random-values');
require('./polyfills');
require('expo-router/entry');
