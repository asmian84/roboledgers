import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        chunkSizeWarningLimit: 700,  // Brain JSON adds ~477KB
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split brain data into separate cacheable chunks
                    'categorization-brain': ['./src/data/categorization_brain.json'],
                    'context-brain': ['./src/data/context_brain.json'],
                }
            }
        }
    }
});
