import { defineConfig } from 'vitest/config';

// Config separata da vite.config.js: i test di logica pura non hanno bisogno del plugin SvelteKit.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
});
