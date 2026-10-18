import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: process.env.PESAKIT_LIVE ? [] : ['test/live.test.ts'],
    coverage: { include: ['src/**'], reporter: ['text', 'lcov'] },
  },
});
