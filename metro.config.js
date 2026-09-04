const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .gguf to asset extensions so Metro bundles the LLM models correctly
config.resolver.assetExts.push('gguf');

// Ignore android/.gradle and build directories from Metro watcher
config.resolver.blockList = [
  /.*\/android\/\.gradle\/.*/,
  /.*\/android\/build\/.*/,
  /.*\/android\/app\/build\/.*/,
  /.*\/ios\/build\/.*/,
];

module.exports = config;
