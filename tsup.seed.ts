import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['prisma/seed.ts'],
    outDir: 'dist',
    format: 'esm',
    clean: false, // Do not clean dist to preserve index.js from build:web
    shims: true,
    platform: 'node',
    target: 'node18',
    skipNodeModulesBundle: true, // Crucial: Do not bundle any node_modules
    external: [
        './generated/client',
        './generated/client/index.js',
        '@prisma/client'
    ],
    splitting: false,
    sourcemap: false,
});
