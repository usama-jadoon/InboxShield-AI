import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Co-located behavior tests live next to their source (CLAUDE.md §10).
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
