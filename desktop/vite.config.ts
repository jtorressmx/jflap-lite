import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { watch: { ignored: ['**/release/**', '**/test-results/**'] } },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
});
