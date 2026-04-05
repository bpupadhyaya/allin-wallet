module.exports = {
  dependencies: {
    '@solana-mobile/mobile-wallet-adapter-protocol': {
      platforms: {
        ios: null,
        android: null, // Use browser stub via Metro, not native module
      },
    },
    '@solana-mobile/seed-vault-lib': {
      platforms: {
        ios: null, // No iOS support
        android: {}, // Enable autolinking on Android
      },
    },
  },
};
