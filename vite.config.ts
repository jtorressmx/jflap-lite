import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { license: { fileName: 'THIRD-PARTY-LICENSES.md' } },
  server: { watch: { ignored: ['**/release/**'] } },
});
