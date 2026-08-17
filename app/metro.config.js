// Required for Expo web support only (Android/iOS via Expo Go are unaffected
// by this file). expo-sqlite's web implementation is backed by a WASM SQLite
// build (wa-sqlite); Metro doesn't bundle .wasm files as static assets by
// default, and the wasm module needs SharedArrayBuffer, which browsers only
// expose on cross-origin-isolated pages. Both requirements are called out in
// the official docs: https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Treat .wasm as a bundleable asset instead of source Metro tries to parse.
config.resolver.assetExts.push('wasm');

// Cross-origin isolation headers, required for SharedArrayBuffer on web.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    middleware(req, res, next);
  };
};

module.exports = config;
