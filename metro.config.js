const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ignore android/.gradle and build directories from Metro watcher
config.resolver.blockList = [
  /.*\/android\/\.gradle\/.*/,
  /.*\/android\/build\/.*/,
  /.*\/android\/app\/build\/.*/,
  /.*\/ios\/build\/.*/,
];

module.exports = config;
