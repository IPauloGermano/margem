import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('preload-helper')
          ) {
            return 'vendor-react';
          }
          if (id.includes('pdfjs-dist')) {
            return 'vendor-pdf';
          }
          if (id.includes('jszip')) {
            return 'vendor-epub';
          }
          if (id.includes('marked') || id.includes('dompurify')) {
            return 'vendor-parser-utils';
          }
          if (id.includes('katex')) {
            return 'vendor-katex';
          }
          if (id.includes('mermaid')) {
            return 'vendor-mermaid';
          }
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT ?? 5173),
    strictPort: false
  }
});
