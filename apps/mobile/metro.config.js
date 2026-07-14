const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../..')];
config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('wasm'); // expo-sqlite web worker
module.exports = config;
