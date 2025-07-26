import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // This tells Vitest where to find your tests. It will look in the src folder.
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // This tells Vitest to ignore the root Playwright folder.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],

    globals: true,
    environment: 'jsdom', // Use the JSDOM environment to simulate a browser
    
    // This is the most critical line. It tells Vitest to run our setup
    // file before any tests are executed.
    setupFiles: './src/tests/setup.ts', 
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});