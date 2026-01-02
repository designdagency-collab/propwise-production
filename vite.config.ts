import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  // SECURITY: No API keys exposed to client
  // Gemini API calls are made server-side via /api/property-insights
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
