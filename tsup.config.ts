import { defineConfig } from 'tsup'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'
import pkg from './package.json' assert { type: 'json' }

export default defineConfig((options) => ({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  env: { VERSION: pkg.version },
  format: ['cjs', 'esm', 'iife'],
  globalName: 'taichunmin.bitfinex',
  keepNames: true,
  minify: !options.watch,
  sourcemap: true,
  splitting: false,
  esbuildPlugins: [
    nodeModulesPolyfillPlugin(),
  ],
}))
