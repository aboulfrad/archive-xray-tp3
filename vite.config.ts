import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/types.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 75 },
    },
  },
});
