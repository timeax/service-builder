import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.tsx'],
    tsconfig: './tsconfig.lib.json',
    format: ['esm'],
    target: 'es2022',
    dts: {
        tsconfig: './tsconfig.lib.json',
    },
    clean: true,
    sourcemap: true,
    esbuildOptions(options) {
        options.conditions = [...(options.conditions ?? []), 'style'];
    },
    external: [
        'react',
        'react-dom',
        '@xyflow/react',
        '@timeax/digital-service-engine',
        '@timeax/digital-service-engine/react',
        '@timeax/digital-service-engine/workspace',
    ],
});
