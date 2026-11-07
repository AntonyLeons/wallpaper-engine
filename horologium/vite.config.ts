export default {
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'oxc',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
};
