import * as esbuild from 'esbuild';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), '../dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Copy Vditor static assets
import { cpSync } from 'fs';
const publicDir = path.resolve(process.cwd(), 'public');

// Manually copy specific Vditor files if they exist in source
// Note: We need to locate where vditor assets are actually stored in source.
// Based on server/index.ts, they seem to be in ./lute.min.js and ./vditor/
// We should check if they need to be copied to ../dist/js/ or similar.
// Looking at server/index.ts: serveVditorFile('/dist/js/lute/lute.min.js', './lute.min.js');
// This implies the route /dist/js/lute/lute.min.js serves local ./lute.min.js
// But for production build, we might need to copy them to ../dist/ if we want them served statically?
// Actually, server/index.ts serves them from local CWD relative path even in production?
// "res.sendFile(path.resolve(__dirname, filePath))"
// In prod, __dirname is where index.js is (dist folder).
// So we need to copy ./lute.min.js -> ../dist/lute.min.js
// And ./vditor -> ../dist/vditor
function copyAssets() {
  console.log('Copying static assets...');
  try {
    const assets = [
      { src: 'lute.min.js', dest: 'lute.min.js' },
      { src: 'vditor', dest: 'vditor' }
    ];
    assets.forEach(asset => {
      const srcPath = path.resolve(process.cwd(), asset.src);
      const destPath = path.resolve(distDir, asset.dest);
      if (existsSync(srcPath)) {
        cpSync(srcPath, destPath, { recursive: true });
        console.log(`Copied ${asset.src} to ${destPath}`);
      } else {
        console.warn(`Asset not found: ${srcPath}`);
      }
    });
  } catch (e) {
    console.error('Error copying assets:', e);
  }
}

async function build() {
  try {
    copyAssets();
    const result = await esbuild.build({
      entryPoints: ['index.ts'],
      bundle: true,
      minify: true,
      platform: 'node',
      target: 'node18',
      outfile: '../dist/index.js',
      format: 'cjs',
      sourcemap: true,
      metafile: true,
      banner: {
        js: '#!/usr/bin/env bun\n',
      },
      packages: 'bundle',
      external: [
        'buffer', 'crypto', 'events', 'fs', 'http', 'https', 'net',
        'os', 'path', 'querystring', 'stream', 'util', 'zlib',
        '@node-rs/crc32',
        'lightningcss',
        'llamaindex',
        'onnxruntime-node',
        'onnxruntime-web',
        '@langchain/community',
        'sharp',
        'esbuild',
        'sqlite3',
        'sqlite3',
        '@libsql/linux-x64-musl',
        '@libsql/linux-x64-gnu',
        '@libsql/linux-arm64-musl',
        '@libsql/linux-arm64-gnu',
        'fsevents'
      ],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      loader: {
        '.ts': 'ts',
        '.js': 'js',
        '.mjs': 'js',
        '.cjs': 'js',
        '.json': 'json',
      },
      conditions: ['node', 'require'],
      mainFields: ['main'],
    });

    console.log('Build successful!');
    console.log(`Output file: ${path.resolve(process.cwd(), '../dist/index.js')}`);

    if (result.metafile) {
      const outputFile = Object.keys(result.metafile.outputs)[0];
      const fileSizeMB = result.metafile.outputs[outputFile].bytes / 1024 / 1024;
      console.log(`JS size: ${fileSizeMB.toFixed(2)}MB`);

      const sortedInputs = Object.entries(result.metafile.inputs)
        .sort((a, b) => b[1].bytes - a[1].bytes)
        .slice(0, 10);

      console.log('\nThe largest 10 modules:');
      for (const [name, info] of sortedInputs) {
        console.log(`- ${name}: ${(info.bytes / 1024).toFixed(2)}KB`);
      }
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 