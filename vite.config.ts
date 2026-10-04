import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                stagemaker: resolve(__dirname, 'stagemaker.html'),
            },
        },
    },
});
