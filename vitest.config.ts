import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: [
      'packages/shared/vitest.config.ts',
      'apps/api/vitest.config.ts',
      'packages/probe/vitest.config.ts',
    ],
  },
});
