import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/domain',
      '@state': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/state',
      '@ui': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/ui',
      '@theming': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/theming',
      '@utils': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/utils',
      '@data': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/data',
  '@components': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/components',
  '@contexts': '/home/nathanriley/Documents/Code/sigilweaver/sigilweaver-frontend/src/contexts'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.{ts,tsx}','src/**/__tests__/**/*.{ts,tsx}']
  }
});
