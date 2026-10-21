import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-expect-error
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        preserveSymlinks: true,
        dedupe: ['react', 'react-dom'],
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
        server: {
            deps: {
                inline: ['@elqora/dgp-ordering-form-palette', '@timeax/form-palette'],
            },
        },
    },
});
