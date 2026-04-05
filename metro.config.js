const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Polyfill Node.js built-ins for React Native
config.resolver.extraNodeModules = {
  buffer: require.resolve('buffer'),
  // ethers v6 CJS build does require('crypto') — shim it with @noble/hashes
  crypto: require.resolve('./crypto.shim.js'),
};

// @solana-mobile/mobile-wallet-adapter-protocol ships an index.native.js that
// calls TurboModuleRegistry.getEnforcing('SolanaMobileWalletAdapter') at
// module init time. Redirect to browser stub on all platforms.
const MWA_BROWSER_STUB = path.resolve(
  __dirname,
  'node_modules/@solana-mobile/mobile-wallet-adapter-protocol/lib/cjs/index.browser.js'
);
const MWA_WEB3JS_BROWSER_STUB = path.resolve(
  __dirname,
  'node_modules/@solana-mobile/mobile-wallet-adapter-protocol-web3js/lib/cjs/index.browser.js'
);

const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@solana-mobile/mobile-wallet-adapter-protocol') {
    return { type: 'sourceFile', filePath: MWA_BROWSER_STUB };
  }
  if (moduleName === '@solana-mobile/mobile-wallet-adapter-protocol-web3js') {
    return { type: 'sourceFile', filePath: MWA_WEB3JS_BROWSER_STUB };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
