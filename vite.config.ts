/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'istanbul',
      // lcov is what Codecov reads; text keeps the summary in the terminal.
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/stories/**',
        'src/__tests__/**',
        'src/**/*.stories.tsx',
        'src/index.ts',
        'src/constants.ts',
        'src/types.ts',
      ],
    },
  },
});
