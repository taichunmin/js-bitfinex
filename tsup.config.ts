import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['cjs', 'esm', 'iife'],
  globalName: 'taichunmin.bitfinex',
  keepNames: true,
  minify: !options.watch,
  sourcemap: true,
  splitting: false,
}))
