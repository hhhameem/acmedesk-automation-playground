import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 4040,
    strictPort: true,
    open: false,
  },
  preview: {
    port: 4040,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: they change far less often than app code,
        // so browsers keep them cached across deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'zustand'],
          charts: ['recharts'],
        },
      },
    },
  },
});
