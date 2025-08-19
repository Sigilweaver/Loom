import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
  '@domain': path.resolve(__dirname, 'src/domain'),
  '@state': path.resolve(__dirname, 'src/state'),
  '@ui': path.resolve(__dirname, 'src/ui'),
  '@theming': path.resolve(__dirname, 'src/theming'),
  '@utils': path.resolve(__dirname, 'src/utils'),
  '@data': path.resolve(__dirname, 'src/data'),
  '@components': path.resolve(__dirname, 'src/components'),
  '@contexts': path.resolve(__dirname, 'src/contexts')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.{ts,tsx}','src/**/__tests__/**/*.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        '**/vite-env.d.ts',
        'electron/**',
        'dist/**',
        'dist-electron/**'
      ]
    }
  }
});
