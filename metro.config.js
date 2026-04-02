const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Polyfill Node.js built-ins for React Native
config.resolver.extraNodeModules = {
  buffer: require.resolve('buffer'),
};

module.exports = config;
