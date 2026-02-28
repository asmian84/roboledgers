import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    plugins: [
        react(),
        // Copy all vanilla JS/CSS files that are loaded as plain <script> / <link> tags
        // (not bundled by Vite since they lack type="module")
        viteStaticCopy({
            targets: [
                // Bank parsers
                { src: 'src/parsers_raw',          dest: 'src' },
                // Core engine + UI shell
                { src: 'src/ui/enterprise/*.js',   dest: 'src/ui/enterprise' },
                { src: 'src/ui/enterprise/*.css',  dest: 'src/ui/enterprise' },
                { src: 'src/ui/workspace',         dest: 'src/ui' },
                { src: 'src/ui/components/*.js',   dest: 'src/ui/components' },
                // Themes + custom CSS
                { src: 'src/ui/custom-dropdown.css', dest: 'src/ui' },
                { src: 'themes',                   dest: '.' },
                // Data files fetched at runtime by bundled modules
                { src: 'src/data/vendor_dictionary.json',  dest: 'src/data' },
                { src: 'src/data/vendor_training.json',    dest: 'src/data' },
                // Logos
                { src: 'public/logos',             dest: 'logos' },
            ]
        })
    ],
    server: {
        port: 5173,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks: {
                    'categorization-brain': ['./src/data/categorization_brain.json'],
                    'context-brain':        ['./src/data/context_brain.json'],
                }
            }
        }
    }
});
