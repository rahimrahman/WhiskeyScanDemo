module.exports = function (api) {
  const isTest = api.cache.using(
    () => process.env.BABEL_ENV === 'test' || process.env.NODE_ENV === 'test',
  );

  return {
    presets: ['babel-preset-expo', !isTest && 'nativewind/babel'].filter(Boolean),
  };
};
