import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'copy-manifest',
      closeBundle() {
        mkdirSync('dist/icons', { recursive: true })
        copyFileSync('src/manifest.json', 'dist/manifest.json')
        for (const size of [16, 32, 48, 128]) {
          try { copyFileSync(`icons/icon${size}.png`, `dist/icons/icon${size}.png`) } catch {}
        }
      }
    }
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        preview: resolve(__dirname, 'src/preview/index.html'),
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: ({ name }) =>
          name?.endsWith('.css') ? 'css/[name][extname]' : '[name][extname]',
      }
    }
  }
})
