module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Reanimated 4 moved its babel plugin into the new `react-native-worklets`
    // package. Must be LAST in the plugins array per the upstream docs.
    plugins: ['react-native-worklets/plugin'],
  };
};
