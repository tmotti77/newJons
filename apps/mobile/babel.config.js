module.exports = function (api) {
  api.cache(true);
  return {
    // unstable_transformImportMeta: zustand v5's ESM build uses `import.meta`,
    // which neither the browser (classic script) nor Hermes can parse. This
    // rewrites it at transpile time so the web bundle (and native) work.
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]]
  };
};
