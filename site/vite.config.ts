import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        downloads: resolve(__dirname, 'downloads.html'),
        contributing: resolve(__dirname, 'contributing.html'),
        terms: resolve(__dirname, 'terms.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        'verify-downloads': resolve(__dirname, 'verify-downloads.html'),
        '403': resolve(__dirname, '403.html'),
        '404': resolve(__dirname, '404.html'),
        '418': resolve(__dirname, '418.html'),
        '500': resolve(__dirname, '500.html'),
        '502': resolve(__dirname, '502.html'),
        '503': resolve(__dirname, '503.html'),
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/styles-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@lib': resolve(__dirname, 'src/lib'),
    },
  },
  server: {
    port: 25808,
    open: true,
  },
});
