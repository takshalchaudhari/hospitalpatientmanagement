import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for SHMF frontend
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});

