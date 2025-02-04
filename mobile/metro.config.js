const {getDefaultConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').ConfigT}
 */
const config = {};
module.exports = getDefaultConfig(__dirname,config);