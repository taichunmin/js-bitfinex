<div align="center">

<h1>@taichunmin/bitfinex</h1>

<p>An unofficial implementation of the <a href="https://docs.bitfinex.com/reference">Bitfinex REST APIs</a> written in TypeScript.</p>

<p>
<a href="https://taichunmin.idv.tw/js-bitfinex/"><b>Documentation</b></a> •
<a href="https://taichunmin.idv.tw/js-bitfinex/classes/Bitfinex.html"><b>Reference</b></a>
</p>

[![npm version](https://img.shields.io/npm/v/@taichunmin/bitfinex.svg?logo=npm)](https://www.npmjs.org/package/@taichunmin/bitfinex)
[![jsdelivr hits](https://img.shields.io/jsdelivr/npm/hm/@taichunmin/bitfinex?logo=jsdelivr)](https://www.jsdelivr.com/package/npm/@taichunmin/bitfinex)
[![Build status](https://img.shields.io/github/actions/workflow/status/taichunmin/js-bitfinex/ci.yml?branch=master)](https://github.com/taichunmin/js-bitfinex/actions/workflows/ci.yml)
[![Coverage Status](https://img.shields.io/coverallsCoverage/github/taichunmin/js-bitfinex?branch=master)](https://coveralls.io/github/taichunmin/js-bitfinex?branch=master)
[![install size](https://img.shields.io/badge/dynamic/json?url=https://packagephobia.com/v2/api.json?p=@taichunmin%2Fbitfinex&query=$.install.pretty&label=install%20size)](https://packagephobia.now.sh/result?p=@taichunmin%2Fbitfinex)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@taichunmin/bitfinex)](https://bundlephobia.com/package/@taichunmin/bitfinex@latest)
[![npm downloads](https://img.shields.io/npm/dm/@taichunmin/bitfinex.svg)](https://npm-stat.com/charts.html?package=@taichunmin%2Fbitfinex)
[![GitHub contributors](https://img.shields.io/github/contributors/taichunmin/js-bitfinex)](https://github.com/taichunmin/js-bitfinex/graphs/contributors)
[![Known vulnerabilities](https://snyk.io/test/npm/@taichunmin/bitfinex/badge.svg)](https://snyk.io/test/npm/@taichunmin/bitfinex)
[![MIT License](https://img.shields.io/github/license/taichunmin/js-bitfinex)](https://github.com/taichunmin/js-buffer/blob/master/LICENSE)

</div>

## Installation

```bash
# npm
npm i --save @taichunmin/bitfinex

# yarn
yarn add @taichunmin/bitfinex
```

## Quickstart

```js
import { Bitfinex } from '@taichunmin/bitfinex'

// For public endpoints
console.log(await Bitfinex.v2PlatformStatus())
// { status: 1 }

// For authenticated endpoints
const bitfinex = new Bitfinex({ apiKey: 'apiKey', apiSecret: 'apiSecret' })
console.log(await bitfinex.v2AuthReadPermissions())
/* {
  account: { read: false, write: false },
  history: { read: true, write: false },
  orders: { read: false, write: false },
  positions: { read: false, write: false },
  funding: { read: true, write: true },
  settings: { read: false, write: false },
  wallets: { read: true, write: false },
  withdraw: { read: false, write: false },
  ui_withdraw: { read: false, write: false },
  bfxpay: { read: false, write: false },
  eaas_agreement: { read: false, write: false },
  eaas_withdraw: { read: false, write: false },
  eaas_deposit: { read: false, write: false },
  eaas_brokerage: { read: false, write: false }
} */
```

## Docs

- [TypeDoc generated reference](https://taichunmin.idv.tw/js-bitfinex/classes/Bitfinex.html)
- [Bitfinex API Reference](https://docs.bitfinex.com/reference)
- [bitfinexcom/bfx-api-node-rest](https://github.com/bitfinexcom/bfx-api-node-rest)

## FAQ

### nonce too small

I make multiple parallel request and I receive an error that the nonce is too small. What does it mean?

Nonces are used to guard against replay attacks. When multiple HTTP requests arrive at the API with the wrong nonce, e.g. because of an async timing issue, the API will reject the request.

If you need to go parallel, you have to use multiple API keys right now.
