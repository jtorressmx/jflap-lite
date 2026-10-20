import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { license: { fileName: 'THIRD-PARTY-LICENSES.md' } },
  server: { watch: { ignored: ['**/release/**'] } },
});
