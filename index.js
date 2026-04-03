// Custom entry point — polyfills MUST be required before expo-router
// so Buffer is available when bcryptjs / @solana/web3.js / ethers initialize.
require('./polyfills');
require('react-native-get-random-values');
require('expo-router/entry');
