import axios, { type AxiosResponse } from 'axios'
import { createHmac } from 'crypto'
import _ from 'lodash'
import * as enums from './enums'
import type * as zod from './zod'
import * as ZodV1SymbolsDetails from './zod/v1SymbolsDetails'
import * as ZodV2AuthReadFundingAutoStatus from './zod/v2AuthReadFundingAutoStatus'
import * as ZodV2AuthReadFundingCredits from './zod/v2AuthReadFundingCredits'
import * as ZodV2AuthReadFundingCreditsHist from './zod/v2AuthReadFundingCreditsHist'
import * as ZodV2AuthReadFundingOffers from './zod/v2AuthReadFundingOffers'
import * as ZodV2AuthReadFundingTradesHist from './zod/v2AuthReadFundingTradesHist'
import * as ZodV2AuthReadInfoFunding from './zod/v2AuthReadInfoFunding'
import * as ZodV2AuthReadInfoUser from './zod/v2AuthReadInfoUser'
import * as ZodV2AuthReadLedgersHist from './zod/v2AuthReadLedgersHist'
import * as ZodV2AuthReadPermissions from './zod/v2AuthReadPermissions'
import * as ZodV2AuthReadWallets from './zod/v2AuthReadWallets'
import * as ZodV2AuthWriteFundingAuto from './zod/v2AuthWriteFundingAuto'
import * as ZodV2AuthWriteFundingOfferCancelAll from './zod/v2AuthWriteFundingOfferCancelAll'
import * as ZodV2CandlesHist from './zod/v2CandlesHist'
import * as ZodV2CandlesLast from './zod/v2CandlesLast'
import * as ZodV2Config from './zod/v2Config'
import * as ZodV2FundingStatsHist from './zod/v2FundingStatsHist'
import * as ZodV2IntGeoIp from './zod/v2IntGeoIp'
import * as ZodV2PlatformStatus from './zod/v2PlatformStatus'
import * as ZodV2Ticker from './zod/v2Ticker'
import * as ZodV2Tickers from './zod/v2Tickers'
import * as ZodV2TickersHist from './zod/v2TickersHist'
import * as ZodV2TradesHist from './zod/v2TradesHist'

const V2ConfigRequestConst = _.values(enums.V2ConfigRequest)

export class Bitfinex {
  readonly #affCode: string
  readonly #apiKey?: string
  readonly #apiSecret?: string
  readonly #authToken?: string

  constructor (opts: {
    affCode?: string
    apiKey?: string
    apiSecret?: string
    authToken?: string
  }) {
    this.#affCode = opts.affCode ?? 'MhocY6Xfp'

    if (!_.isNil(opts.apiKey) && !_.isNil(opts.apiSecret)) {
      this.#apiKey = opts.apiKey
      this.#apiSecret = opts.apiSecret
    } else if (!_.isNil(opts.authToken)) {
      this.#authToken = opts.authToken
    } else throw new Error('missing api key, api secret or auth token')
  }

  static #createNonce (): string {
    return `${Date.now()}000`
  }

  static async #apiGetPub <TRes extends zod.JsonValue = zod.JsonValue, TBody extends zod.JsonObject = zod.JsonObject> (opts: {
    query?: TBody
    headers?: Record<string, string>
    path: string
  }): Promise<TRes> {
    const trace: Record<string, any> = {}
    try {
      trace.url = new URL(opts.path, 'https://api-pub.bitfinex.com/').href
      const res = await axios.get<TRes, AxiosResponse<TRes>>(trace.url, {
        headers: opts.headers,
        params: opts.query,
      })
      return res.data
    } catch (err) {
      throw _.update(err, 'data.apiGetPub', orig => orig ?? { ...trace, opts })
    }
  }

  #hmacSha384Hex (opts: { bodyJson: string, nonce: string, path: string }): string {
    const data = `/api/${opts.path}${opts.nonce}${opts.bodyJson}`
    return createHmac('sha384', this.#apiSecret ?? '').update(data).digest('hex')
  }

  async #apiPostAuth <TRes extends zod.JsonValue = zod.JsonValue, TBody extends zod.JsonObject = zod.JsonObject> (opts: {
    body?: TBody
    headers?: Record<string, string>
    path: string
  }): Promise<TRes> {
    const trace: Record<string, any> = {}
    try {
      trace.url = new URL(opts.path, 'https://api.bitfinex.com/').href
      const bodyJson = trace.bodyJson = JSON.stringify(_.omitBy(opts.body, _.isNil) ?? {})
      const nonce = Bitfinex.#createNonce()
      trace.headers = {
        ...(opts.headers ?? {}),
        'Content-Type': 'application/json',
        'bfx-nonce': nonce,
      }
      if (!_.isNil(this.#authToken)) {
        trace.headers['bfx-token'] = this.#authToken
      } else if (!_.isNil(this.#apiKey)) {
        const signature = this.#hmacSha384Hex({ bodyJson, nonce, path: opts.path })
        _.merge(trace.headers, {
          'bfx-apikey': this.#apiKey,
          'bfx-signature': signature,
        })
      }
      const res = await axios.post<TRes, AxiosResponse<TRes>>(trace.url, bodyJson, { headers: trace.headers })
      return res.data
    } catch (err) {
      const errData = err?.response?.data ?? []
      if (errData[0] === 'error') {
        const [, code, message] = errData
        err = _.set(new Error(`(${code}) ${message}`), 'originalError', err)
      }
      throw _.update(err, 'data.apiPostAuth', orig => orig ?? { ...trace, opts })
    }
  }

  /**
   * 取得目前 Bitfinex 平台的運作狀態。維護狀態通常會持續幾分鐘到幾小時，並且在基礎設施升級期間也有可能進入維護狀態。
   *
   * 當平台標記為維護模式時，機器人應停止所有交易活動。在維護模式時可能會無法取消訂單和下單。
   * @group v2
   * @returns
   * - status: operative = 1, maintenance = 0
   * @see [Platform Status | BitFinex API](https://docs.bitfinex.com/reference/rest-public-platform-status)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2PlatformStatus()) // Expected output: { status: 1 }
   * ```
   */
  static async v2PlatformStatus (): Promise<ZodV2PlatformStatus.Output> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'v2/platform/status',
      })
      return ZodV2PlatformStatus.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2PlatformStatus', old => old ?? trace)
    }
  }

  /**
   * 取得指定交易對目前的行情概覽。它會回傳當前最佳買入價和賣出價、最近成交價，以及昨日至今的每日成交量和價格變動資訊。
   * @group v2
   * @param opts - 參數說明
   * - pair: 交易對代碼
   * @returns
   * - symbol: 交易對代碼
   * - pair: 交易對代碼
   * - bidPrice: 最高的買入價
   * - bidSize: 最高的 25 個買入價總數量
   * - askPrice: 最低的賣出價
   * - askSize: 最低的 25 個賣出價總數量
   * - dailyChange: 昨日至今的價格變化量
   * - dailyChangeRelative: 昨日至今的相對價格變化（乘以 100 即為百分比變化）
   * - lastPrice: 最新成交價
   * - volume: 昨日至今的成交量
   * - high: 昨日至今的最高價
   * - low: 昨日至今的最低價
   * @see [Ticker | BitFinex API](https://docs.bitfinex.com/reference/rest-public-ticker)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2Ticker({ pair: 'BTCUSD' }))
   * /* Expected output:
   * {
   *   symbol: 'tBTCUSD',
   *   bidPrice: 82388,
   *   bidSize: 10.16663748,
   *   askPrice: 82389,
   *   askSize: 4.73069672,
   *   dailyChange: -1154,
   *   dailyChangeRelative: -0.01381821,
   *   lastPrice: 82359,
   *   volume: 715.62902556,
   *   high: 83697,
   *   low: 81481,
   *   pair: 'BTCUSD'
   * }
   * *\/
   * ```
   */
  static async v2Ticker (opts: ZodV2Ticker.InputPair): Promise<ZodV2Ticker.OutputPair>

  /**
   * 取得指定融資貨幣目前的行情概覽。它會回傳當前最佳買入價和賣出價、最近成交價，以及昨日至今的每日成交量和價格變動資訊。
   * @group v2
   * @param opts - 參數說明
   * - currency: 貨幣代碼
   * @returns
   * - symbol: 融資代碼
   * - currency: 貨幣代碼
   * - frr: [Flash Return Rate](https://support.bitfinex.com/hc/en-us/articles/213919009-What-is-the-Bitfinex-Funding-Flash-Return-Rate)
   * - dpr: Daily Percentage Rate，由公式 `frr * 100` 計算產生
   * - apr: Annual Percentage Rate，由公式 `frr * 100 * 365` 計算產生
   * - bidPrice: 最高的貸款利率
   * - bidPeriod: 最高貸款利率的天數
   * - bidSize: 最高的 25 個貸款利率的總數量
   * - askPrice: 最低的放款利率
   * - askPeriod: 最低放款利率的天數
   * - askSize: 最低的 25 個放款利率的總數量
   * - dailyChange: 昨日至今的利率變化量
   * - dailyChangePerc: 昨日至今的相對利率變化（乘以 100 即為百分比變化）
   * - lastPrice: 最新成交利率
   * - volume: 昨日至今的成交量
   * - high: 昨日至今的最高利率
   * - low: 昨日至今的最低利率
   * - frrAmountAvailable: 以 FRR 進行貸款或放款的數量
   * @see [Ticker | BitFinex API](https://docs.bitfinex.com/reference/rest-public-ticker)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2Ticker({ currency: 'USD' }))
   * /* Expected output:
   * {
   *   symbol: 'fUSD',
   *   frr: 0.0003347671232876712,
   *   bidPrice: 0.0003347671232876712,
   *   bidPeriod: 30,
   *   bidSize: 33194024.88639909,
   *   askPrice: 0.0001639,
   *   askPeriod: 2,
   *   askSize: 42436.36607463,
   *   dailyChange: -9.1e-7,
   *   dailyChangePerc: -0.0061,
   *   lastPrice: 0.00014799,
   *   volume: 143727499.90044996,
   *   high: 0.00059907,
   *   low: 0.00007945,
   *   frrAmountAvailable: 45904.65709059,
   *   currency: 'USD',
   *   dpr: 0.03347671,
   *   apr: 12.219
   * }
   * *\/
   * ```
   */
  static async v2Ticker (opts: ZodV2Ticker.InputCurrency): Promise<ZodV2Ticker.OutputCurrency>

  /**
   * 取得指定交易對或融資貨幣目前的行情概覽。它會回傳當前最佳買入價和賣出價、最近成交價，以及昨日至今的每日成交量和價格變動資訊。
   * @group v2
   * @param opts - 參數說明
   * - symbol: 交易對或融資貨幣
   * @returns
   * - 交易對的行情概覽欄位
   *     - symbol: 交易對代碼
   *     - pair: 交易對代碼
   *     - bidPrice: 最高的買入價
   *     - bidSize: 最高的 25 個買入價總數量
   *     - askPrice: 最低的賣出價
   *     - askSize: 最低的 25 個賣出價總數量
   *     - dailyChange: 昨日至今的價格變化量
   *     - dailyChangeRelative: 昨日至今的相對價格變化（乘以 100 即為百分比變化）
   *     - lastPrice: 最新成交價
   *     - volume: 昨日至今的成交量
   *     - high: 昨日至今的最高價
   *     - low: 昨日至今的最低價
   * - 融資的行情概覽欄位
   *     - symbol: 融資代碼
   *     - currency: 貨幣代碼
   *     - frr: [Flash Return Rate](https://support.bitfinex.com/hc/en-us/articles/213919009-What-is-the-Bitfinex-Funding-Flash-Return-Rate)
   *     - dpr: Daily Percentage Rate，由公式 `frr * 100` 計算產生
   *     - apr: Annual Percentage Rate，由公式 `frr * 100 * 365` 計算產生
   *     - bidPrice: 最高的貸款利率
   *     - bidPeriod: 最高貸款利率的天數
   *     - bidSize: 最高的 25 個貸款利率的總數量
   *     - askPrice: 最低的放款利率
   *     - askPeriod: 最低放款利率的天數
   *     - askSize: 最低的 25 個放款利率的總數量
   *     - dailyChange: 昨日至今的利率變化量
   *     - dailyChangePerc: 昨日至今的相對利率變化（乘以 100 即為百分比變化）
   *     - lastPrice: 最新成交利率
   *     - volume: 昨日至今的成交量
   *     - high: 昨日至今的最高利率
   *     - low: 昨日至今的最低利率
   *     - frrAmountAvailable: 以 FRR 進行貸款或放款的數量
   * @see [Ticker | BitFinex API](https://docs.bitfinex.com/reference/rest-public-ticker)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2Ticker({ symbol: 'tBTCUSD' }))
   * console.log(await Bitfinex.v2Ticker({ symbol: 'fUSD' }))
   * ```
   */
  static async v2Ticker (opts: ZodV2Ticker.InputSymbol): Promise<ZodV2Ticker.Output>

  static async v2Ticker (opts: ZodV2Ticker.Input): Promise<ZodV2Ticker.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const symbol = trace.symbol = ZodV2Ticker.ZodInput.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/ticker/${symbol}`,
      })
      return ZodV2Ticker.parseOutput([symbol, ...trace.resp])
    } catch (err) {
      throw _.update(err, 'data.v2Ticker', old => old ?? trace)
    }
  }

  /**
   * 取得交易對以及融資目前的行情概覽。它會回傳當前最佳買入價和賣出價、最近成交價，以及昨日至今的每日成交量和價格變動資訊。這個 API 允許同時取得多個交易對及融資的行情資訊。
   * @group v2
   * @param opts - 參數說明
   * - symbols: 交易對或融資貨幣的陣列，或指定 ALL 取得全部的行情概覽，預設為 `ALL`。
   * @returns
   * - 交易對的行情概覽欄位
   *     - symbol: 交易對代碼
   *     - pair: 交易對代碼
   *     - bidPrice: 最高的買入價
   *     - bidSize: 最高的 25 個買入價總數量
   *     - askPrice: 最低的賣出價
   *     - askSize: 最低的 25 個賣出價總數量
   *     - dailyChange: 昨日至今的價格變化量
   *     - dailyChangeRelative: 昨日至今的相對價格變化（乘以 100 即為百分比變化）
   *     - lastPrice: 最新成交價
   *     - volume: 昨日至今的成交量
   *     - high: 昨日至今的最高價
   *     - low: 昨日至今的最低價
   * - 融資的行情概覽欄位
   *     - symbol: 融資代碼
   *     - currency: 貨幣代碼
   *     - frr: [Flash Return Rate](https://support.bitfinex.com/hc/en-us/articles/213919009-What-is-the-Bitfinex-Funding-Flash-Return-Rate)
   *     - dpr: Daily Percentage Rate，由公式 `frr * 100` 計算產生
   *     - apr: Annual Percentage Rate，由公式 `frr * 100 * 365` 計算產生
   *     - bidPrice: 最高的貸款利率
   *     - bidPeriod: 最高貸款利率的天數
   *     - bidSize: 最高的 25 個貸款利率的總數量
   *     - askPrice: 最低的放款利率
   *     - askPeriod: 最低放款利率的天數
   *     - askSize: 最低的 25 個放款利率的總數量
   *     - dailyChange: 昨日至今的利率變化量
   *     - dailyChangePerc: 昨日至今的相對利率變化（乘以 100 即為百分比變化）
   *     - lastPrice: 最新成交利率
   *     - volume: 昨日至今的成交量
   *     - high: 昨日至今的最高利率
   *     - low: 昨日至今的最低利率
   *     - frrAmountAvailable: 以 FRR 進行貸款或放款的數量
   * @see [Tickers | BitFinex API](https://docs.bitfinex.com/reference/rest-public-tickers)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2Tickers()) // default: ALL symbols
   * console.log(await Bitfinex.v2Tickers({ symbols: 'fUSD' }))
   * console.log(await Bitfinex.v2Tickers({ symbols: ['tBTCUSD', 'fUSD'] }))
   * /* Expected output:
   * [
   *   {
   *     symbol: 'tBTCUSD',
   *     bidPrice: 82254,
   *     bidSize: 8.81387677,
   *     askPrice: 82255,
   *     askSize: 7.91928646,
   *     dailyChange: -1272,
   *     dailyChangeRelative: -0.01523116,
   *     lastPrice: 82241,
   *     volume: 716.48201682,
   *     high: 83697,
   *     low: 81481,
   *     pair: 'BTCUSD'
   *   },
   *   {
   *     symbol: 'fUSD',
   *     frr: 0.0003347671232876712,
   *     bidPrice: 0.0003347671232876712,
   *     bidPeriod: 30,
   *     bidSize: 33193866.53816909,
   *     askPrice: 0.00035676,
   *     askPeriod: 4,
   *     askSize: 442678.99810842,
   *     dailyChange: 0.0002188,
   *     dailyChangePerc: 1.4694,
   *     lastPrice: 0.0003677,
   *     volume: 144225957.2861548,
   *     high: 0.00059907,
   *     low: 0.00007945,
   *     frrAmountAvailable: 0,
   *     currency: 'USD',
   *     dpr: 0.03347671,
   *     apr: 12.219
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2Tickers (opts: ZodV2Tickers.Input = {}): Promise<ZodV2Tickers.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2Tickers.ZodInput.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'v2/tickers',
        query: { symbols: opts1.symbols },
      })
      return ZodV2Tickers.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Tickers', old => old ?? trace)
    }
  }

  /**
   * 取得指定交易對行情概覽的歷史記錄，它會回傳以小時為單位的最佳買入價及賣出價。
   * @group v2
   * @param opts - 參數說明
   * - symbols: 交易對的陣列，或指定 ALL 取得全部的行情概覽，預設為 `ALL`。目前不支援融資貨幣。
   * - start: 回傳的記錄中，`mts` 欄位不小於此值
   * - end: 回傳的記錄中，`mts` 欄位不大於此值
   * - limit: 回傳的記錄數量上限，最大 `250`，預設為 `125`
   * @returns
   * - symbol: 交易對代碼
   * - pair: 交易對代碼
   * - bidPrice: 最高的買入價
   * - askPrice: 最低的賣出價
   * - mts: 記錄的時間
   * @see [Tickers History | BitFinex API](https://docs.bitfinex.com/reference/rest-public-tickers-history)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2TickersHist()) // default: ALL symbols
   * console.log(await Bitfinex.v2TickersHist({ symbols: ['tBTCUSD', 'tETHUSD'], limit: 2 }))
   * console.log(await Bitfinex.v2TickersHist({ symbols: 'tBTCUSD', limit: 2 }))
   * /* Expected output:
   * [
   *   {
   *     symbol: 'tBTCUSD',
   *     bidPrice: 82201,
   *     askPrice: 82202,
   *     mts: 2025-03-31T07:00:03.000Z,
   *     pair: 'BTCUSD'
   *   },
   *   {
   *     symbol: 'tBTCUSD',
   *     bidPrice: 82345,
   *     askPrice: 82346,
   *     mts: 2025-03-31T06:00:03.000Z,
   *     pair: 'BTCUSD'
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2TickersHist (opts: ZodV2TickersHist.Input = {}): Promise<ZodV2TickersHist.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2TickersHist.ZodInput.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'v2/tickers/hist',
        query: _.pick(opts1, ['symbols', 'start', 'end', 'limit']),
      })
      return ZodV2TickersHist.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2TickersHist', old => old ?? trace)
    }
  }

  /**
   * 取得指定交易對的成交記錄。
   * @group v2/trades
   * @param opts - 參數說明
   * - pair: 交易對代碼
   * - limit: 回傳的交易記錄數量上限，最大 `10000`，預設為 `125`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: 交易 ID
   * - mts: 成交時間
   * - amount: 成交數量，買入為正，賣出為負。
   * - price: 成交價格
   * @see [Trades | BitFinex API](https://docs.bitfinex.com/reference/rest-public-trades)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2TradesHist({ pair: 'BTCUSD', limit: 1 }))
   * /* Expected output:
   * [
   *   {
   *     amount: 0.00014115,
   *     id: 1744148660,
   *     mts: 2025-03-31T07:28:25.296Z,
   *     price: 82139
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2TradesHist (opts: ZodV2TradesHist.InputPair): Promise<ZodV2TradesHist.OutputPairs>

  /**
   * 取得指定融資的成交記錄。
   * @group v2/trades
   * @param opts - 參數說明
   * - currency: 貨幣代碼
   * - limit: 回傳的交易記錄數量上限，最大 `10000`，預設為 `125`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: 交易 ID
   * - mts: 成交時間
   * - amount: 成交數量，買入為正，賣出為負。
   * - rate: 融資成交利率
   * - peroid: 融資天數
   * @see [Trades | BitFinex API](https://docs.bitfinex.com/reference/rest-public-trades)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2TradesHist({ currency: 'USD', limit: 1 }))
   * /* Expected output:
   * [
   *   {
   *     amount: -4639.47753284,
   *     id: 356901557,
   *     mts: 2025-03-31T07:30:32.482Z,
   *     period: 2,
   *     rate: 0.00015
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2TradesHist (opts: ZodV2TradesHist.InputCurrency): Promise<ZodV2TradesHist.OutputCurrencys>

  /**
   * 取得指定交易對或融資的成交記錄。
   * @group v2/trades
   * @param opts - 參數說明
   * - symbol: 交易對或融資代碼
   * - limit: 回傳的交易記錄數量上限，最大 `10000`，預設為 `125`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - 如果 symbol 是交易對代碼時：
   *     - id: 交易 ID
   *     - mts: 成交時間
   *     - amount: 成交數量，買入為正，賣出為負。
   *     - price: 成交價格
   * - 如果 symbol 是融資代碼時：
   *     - id: 交易 ID
   *     - mts: 成交時間
   *     - amount: 成交數量，買入為正，賣出為負。
   *     - rate: 融資成交利率
   *     - peroid: 融資天數
   * @see [Trades | BitFinex API](https://docs.bitfinex.com/reference/rest-public-trades)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2TradesHist({ symbol: 'fUSD', limit: 1 }))
   * console.log(await Bitfinex.v2TradesHist({ symbol: 'tBTCUSD', limit: 1 }))
   * ```
   */
  static async v2TradesHist (opts: ZodV2TradesHist.InputSymbol): Promise<ZodV2TradesHist.Output>

  static async v2TradesHist (opts: ZodV2TradesHist.Input): Promise<ZodV2TradesHist.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2TradesHist.ZodInput.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/trades/${opts1.symbol}/hist`,
        query: _.pick(opts1, ['limit', 'sort', 'start', 'end']),
      })
      return ZodV2TradesHist.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2TradesHist', old => old ?? trace)
    }
  }

  /**
   * 取得指定交易對 `pair` 的歷史 K 棒。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - pair: 交易對代碼，預設為 `BTCUSD`
   * - limit: 資料筆數的上限，最大 `10000`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - mts: 成交時間
   * - open: 開盤價
   * - close: 收盤價
   * - high: 最高價
   * - low: 最低價
   * - volume: 成交量
   * @see [Candles | BitFinex API](https://docs.bitfinex.com/reference/rest-public-candles)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2CandlesHist({ pair: 'BTCUSD', timeframe: '1h', limit: 1 }))
   * /* Expected output:
   * [
   *   {
   *     mts: 2025-03-31T08:00:00.000Z,
   *     open: 82073,
   *     close: 82206,
   *     high: 82388,
   *     low: 82073,
   *     volume: 1.84279286
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2CandlesHist (opts: ZodV2CandlesHist.InputPair): Promise<ZodV2CandlesHist.Output>

  /**
   * 取得指定融資貨幣 `currency` 的歷史 K 棒。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - currency: 貨幣代碼，預設為 `USD`
   * - period: 融資天數，預設為 2
   * - limit: 資料筆數的上限，最大 `10000`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - mts: 成交時間
   * - open: 開盤利率
   * - close: 收盤利率
   * - high: 最高利率
   * - low: 最低利率
   * - volume: 成交量
   * @see [Candles | BitFinex API](https://docs.bitfinex.com/reference/rest-public-candles)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2CandlesHist({ currency: 'USD', timeframe: '1h', period: 2, limit: 1 }))
   * /* Expected output:
   * [
   *   {
   *     mts: 2025-03-31T08:00:00.000Z,
   *     open: 0.00025,
   *     close: 0.00042729,
   *     high: 0.00042729,
   *     low: 0.00025,
   *     volume: 79474.06069641
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2CandlesHist (opts: ZodV2CandlesHist.InputCurrencyPeriod1): Promise<ZodV2CandlesHist.Output>

  /**
   * 取得指定融資貨幣 `currency` 的歷史 K 棒。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - currency: 貨幣代碼，預設為 `USD`
   * - periodStart: 融資天數的開始範圍
   * - periodEnd: 融資天數的結束範圍
   * - aggregation: 資料聚合的方式，可指定 `10` 或 `30`，預設為 `30`
   * - limit: 資料筆數的上限，最大 `10000`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - mts: 成交時間
   * - open: 開盤利率
   * - close: 收盤利率
   * - high: 最高利率
   * - low: 最低利率
   * - volume: 成交量
   * @see [Candles | BitFinex API](https://docs.bitfinex.com/reference/rest-public-candles)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2CandlesHist({ currency: 'USD', timeframe: '1h', periodStart: 2, periodEnd: 30, aggregation: 30, limit: 1 }))
   * /* Expected output:
   * [
   *   {
   *     mts: 2025-03-31T08:00:00.000Z,
   *     open: 0.00025,
   *     close: 0.0004273,
   *     high: 0.0004273,
   *     low: 0.00025,
   *     volume: 255358.55160453
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2CandlesHist (opts: ZodV2CandlesHist.InputCurrencyPeriod2): Promise<ZodV2CandlesHist.Output>

  static async v2CandlesHist (opts: ZodV2CandlesHist.Input): Promise<ZodV2CandlesHist.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2CandlesHist.ZodInput.parse(opts) as ZodV2CandlesHist.Input & Record<string, undefined>
      if (_.isString(opts1.pair)) trace.candle = `trade:${opts1.timeframe}:t${opts1.pair}`
      else if (_.isString(opts1.currency)) trace.candle = `trade:${opts1.timeframe}:f${opts1.currency}:${opts1.period}`
      if (!_.isString(trace.candle)) throw new Error('invalid pair or currency')
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/candles/${trace.candle}/hist`,
        query: _.omitBy<any>(_.pick(opts1, ['sort', 'start', 'end', 'limit']), _.isNil),
      })
      return ZodV2CandlesHist.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Candles', old => old ?? trace)
    }
  }

  /**
   * 取得指定交易對 `pair` 的最新 K 棒。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - pair: 交易對代碼，預設為 `BTCUSD`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - mts: 成交時間
   * - open: 開盤價
   * - close: 收盤價
   * - high: 最高價
   * - low: 最低價
   * - volume: 成交量
   * @see [Candles | BitFinex API](https://docs.bitfinex.com/reference/rest-public-candles)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2CandlesLast({ pair: 'BTCUSD', timeframe: '1h' }))
   * /* Expected output:
   * {
   *   mts: 2025-03-31T08:00:00.000Z,
   *   open: 82073,
   *   close: 82381,
   *   high: 82388,
   *   low: 82073,
   *   volume: 1.71526122
   * }
   * *\/
   * ```
   */
  static async v2CandlesLast (opts: ZodV2CandlesLast.InputPair): Promise<ZodV2CandlesLast.Output>

  /**
   * 取得指定融資貨幣 `currency` 的最新 K 棒。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - currency: 貨幣代碼，預設為 `USD`
   * - period: 融資天數，預設為 2
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - mts: 成交時間
   * - open: 開盤利率
   * - close: 收盤利率
   * - high: 最高利率
   * - low: 最低利率
   * - volume: 成交量
   * @see [Candles | BitFinex API](https://docs.bitfinex.com/reference/rest-public-candles)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2CandlesLast({ currency: 'USD', timeframe: '1h', period: 2 }))
   * /* Expected output:
   * {
   *   mts: 2025-03-31T08:00:00.000Z,
   *   open: 0.00025,
   *   close: 0.00042729,
   *   high: 0.00042729,
   *   low: 0.00025,
   *   volume: 79474.06069641
   * }
   * *\/
   * ```
   */
  static async v2CandlesLast (opts: ZodV2CandlesLast.InputCurrencyPeriod1): Promise<ZodV2CandlesLast.Output>

  /**
   * 取得指定融資貨幣 `currency` 的最新 K 棒。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - currency: 貨幣代碼，預設為 `USD`
   * - periodStart: 融資天數的開始範圍
   * - periodEnd: 融資天數的結束範圍
   * - aggregation: 資料聚合的方式，可指定 `10` 或 `30`，預設為 `30`
   * - sort: 根據 `mts` 欄位將交易記錄以指定的方式進行排序，預設為 `BitfinexSort.DESC`
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - mts: 成交時間
   * - open: 開盤利率
   * - close: 收盤利率
   * - high: 最高利率
   * - low: 最低利率
   * - volume: 成交量
   * @see [Candles | BitFinex API](https://docs.bitfinex.com/reference/rest-public-candles)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2CandlesLast({ currency: 'USD', timeframe: '1h', periodStart: 2, periodEnd: 30, aggregation: 30 }))
   * /* Expected output:
   * {
   *   mts: 2025-03-31T08:00:00.000Z,
   *   open: 0.00025,
   *   close: 0.0004273,
   *   high: 0.0004273,
   *   low: 0.00025,
   *   volume: 255358.55160453
   * }
   * *\/
   * ```
   */
  static async v2CandlesLast (opts: ZodV2CandlesLast.InputCurrencyPeriod2): Promise<ZodV2CandlesLast.Output>

  static async v2CandlesLast (opts: ZodV2CandlesLast.Input): Promise<ZodV2CandlesLast.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2CandlesLast.ZodInput.parse(opts) as ZodV2CandlesLast.Input & Record<string, undefined>
      if (_.isString(opts1.pair)) trace.candle = `trade:${opts1.timeframe}:t${opts1.pair}`
      else if (_.isString(opts1.currency)) trace.candle = `trade:${opts1.timeframe}:f${opts1.currency}:${opts1.period}`
      if (!_.isString(trace.candle)) throw new Error('invalid pair or currency')
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/candles/${trace.candle}/last`,
        query: _.omitBy<any>(_.pick(opts1, ['sort', 'start', 'end']), _.isNil),
      })
      return ZodV2CandlesLast.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Candles', old => old ?? trace)
    }
  }

  /**
   * 取得所有的 Bifinex 設定檔。
   * @group v2
   * @returns Bifinex 所有設定檔的內容。
   * @see [Configs | BitFinex API](https://docs.bitfinex.com/reference/rest-public-conf)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2Config())
   * ```
   */
  static async v2Config (): Promise<Record<enums.V2ConfigRequest, zod.JsonValue>>

  /**
   * 取得指定的 Bifinex 設定檔。
   * @group v2
   * @param req - 設定檔的名稱。
   * @returns Bifinex 設定檔的內容。
   * @see [Configs | BitFinex API](https://docs.bitfinex.com/reference/rest-public-conf)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2Config('pub:spec:site:maintenance'))
   * /* Expected output:
   * {
   *   id: 'maintenance-march-06-2023',
   *   start: '2023-03-06 09:00:00',
   *   duration: 6,
   *   url: 'https://blog.bitfinex.com/?p=21173'
   * }
   * *\/
   * ```
   */
  static async v2Config (req: enums.V2ConfigRequest): Promise<zod.JsonValue>

  /**
   * 取得指定的 Bifinex 設定檔。
   * @group v2
   * @param reqs - 設定檔名稱的陣列。
   * @returns Bifinex 設定檔的內容。
   * @see [Configs | BitFinex API](https://docs.bitfinex.com/reference/rest-public-conf)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2Config(['pub:spec:site:maintenance', 'pub:list:category:securities']))
   * /* Expected output:
   * {
   *   'pub:spec:site:maintenance': {
   *     id: 'maintenance-march-06-2023',
   *     start: '2023-03-06 09:00:00',
   *     duration: 6,
   *     url: 'https://blog.bitfinex.com/?p=21173'
   *   },
   *   'pub:list:category:securities': [
   *     [
   *       'aifc',
   *       'AIFC',
   *       'ALT2612:USD',
   *       'AIFC',
   *       'Bitfinex Securities Ltd.'
   *     ],
   *     [
   *       'el_salvador',
   *       'El Salvador',
   *       'USTBL:UST',
   *       'El-Salvador',
   *       'Bitfinex Securities El Salvador, S.A. de C.V.'
   *     ]
   *   ]
   * }
   * *\/
   * ```
   */
  static async v2Config <TReq extends enums.V2ConfigRequest> (reqs: TReq[]): Promise<Record<TReq, zod.JsonValue>>

  static async v2Config (opts?: ZodV2Config.Input): Promise<any> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2Config.ZodInput.parse(opts) ?? V2ConfigRequestConst
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/conf/${opts1.join(',')}`,
      })
      return _.isString(opts) ? _.first(trace.resp) : _.zipObject(opts1, trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Config', old => old ?? trace)
    }
  }

  /**
   * 取得 Bitfinex 所有交易對的詳細資訊。
   * @group v1
   * @returns
   * - pair: 交易對代碼
   * - price_precision: 價格小數點精確度
   * - initial_margin: 初始保證金百分比
   * - minimum_margin: 最低保證金百分比
   * - maximum_order_size: 最大訂單量
   * - minimum_order_size: 最小訂單量
   * - expiration: 過期時間
   * - margin: 保證金交易是否可用
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log((await Bitfinex.v1SymbolsDetails())[0])
   * /* Expected output:
   * {
   *   expiration: 'NA',
   *   initial_margin: 10,
   *   margin: true,
   *   maximum_order_size: 2000,
   *   minimum_margin: 5,
   *   minimum_order_size: 0.00004,
   *   pair: 'btcusd',
   *   price_precision: 5
   * }
   * *\/
   * ```
   */
  static async v1SymbolsDetails (): Promise<ZodV1SymbolsDetails.Output> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'https://api.bitfinex.com/v1/symbols_details',
      })
      return ZodV1SymbolsDetails.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v1SymbolsDetails', old => old ?? trace)
    }
  }

  /**
   * 取得指定貨幣最近的融資統計記錄
   * @group v2/funding
   * @param opts - 參數說明
   * - currency: 貨幣代碼，預設為 `USD`
   * - limit: 回傳的融資統計記錄數量上限，最大 `250`
   * - start: 回傳的融資統計記錄中，`mts` 欄位不小於此值
   * - end: 回傳的融資統計記錄中，`mts` 欄位不大於此值
   * @returns
   * - mts: 融資統計記錄的產生時間
   * - frrDiv365: [Flash Return Rate](https://support.bitfinex.com/hc/en-us/articles/213919009-What-is-the-Bitfinex-Funding-Flash-Return-Rate) 除以 365
   * - frr: [Flash Return Rate](https://support.bitfinex.com/hc/en-us/articles/213919009-What-is-the-Bitfinex-Funding-Flash-Return-Rate)
   * - apr: 年利率 Annual Percentage Rate，由公式 `frr * 365` 計算產生
   * - avgPeriod: 平均融資天數
   * - amount: 融資貨幣總數量
   * - amountUsed: 已使用的融資貨幣數量
   * - belowThreshold: 低於 `0.75%` 的融資貨幣掛單數量
   * @see [Funding Funding Statistics | BitFinex API](https://docs.bitfinex.com/reference/rest-public-funding-stats)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2FundingStatsHist({ currency: 'USD', limit: 1 }))
   * /* Expected output:
   * [
   *   {
   *     mts: 2025-03-31T08:05:00.000Z,
   *     frrDiv365: 9.2e-7,
   *     avgPeriod: 76.12,
   *     amount: 3401493724.8104763,
   *     amountUsed: 3268364679.8992467,
   *     belowThreshold: 126893437.13542865,
   *     frr: 0.0003358,
   *     apr: 0.122567
   *   }
   * ]
   * *\/
   * ```
   */
  static async v2FundingStatsHist (opts: ZodV2FundingStatsHist.Input = {}): Promise<ZodV2FundingStatsHist.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2FundingStatsHist.ZodInput.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/funding/stats/f${opts1.currency}/hist`,
        query: _.pick(opts1, ['limit', 'start', 'end']),
      })
      return ZodV2FundingStatsHist.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2FundingStatsHist', old => old ?? trace)
    }
  }

  /**
   * 取得目前 IP 位址的 GeoIp 資訊。
   * @group v2
   * @returns
   * - ip: IP 位址
   * - range: IP 區塊的上下界
   * - country: 2 letter ISO-3166-1 country code
   * - region: Up to 3 alphanumeric variable length characters as ISO 3166-2 code, For US states this is the 2 letter state, For the United Kingdom this could be ENG as a country like “England", FIPS 10-4 subcountry code
   * - eu: `1` if the country is a member state of the European Union, `0` otherwise.
   * - timezone: Timezone from IANA Time Zone Database
   * - city: full city name
   * - ll: The latitude and longitude of the city
   * - metro: Metro code
   * - area: The approximate accuracy radius (km), around the latitude and longitude
   * @see [geoip-lite](https://www.npmjs.com/package/geoip-lite)
   * @example
   * ```js
   * const { Bitfinex } = require('@taichunmin/bitfinex')
   *
   * console.log(await Bitfinex.v2IntGeoIp())
   * ```
   */
  static async v2IntGeoIp (): Promise<ZodV2IntGeoIp.Output> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'v2/int/geo/ip',
      })
      return ZodV2IntGeoIp.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2IntGeoIp', old => old ?? trace)
    }
  }

  /**
   * 取得目前 apiKey 或 token 的權限。
   * @group v2/auth
   * @see [Key Permissions | BitFinex API](https://docs.bitfinex.com/reference/key-permissions)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const util = require('node:util')
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     const perms = await bitfinex.v2AuthReadPermissions()
   *     console.log(util.inspect(perms))
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * {
   *   account: { read: false, write: false },
   *   history: { read: true, write: false },
   *   orders: { read: false, write: false },
   *   positions: { read: false, write: false },
   *   funding: { read: true, write: true },
   *   settings: { read: false, write: false },
   *   wallets: { read: true, write: false },
   *   withdraw: { read: false, write: false },
   *   ui_withdraw: { read: false, write: false },
   *   bfxpay: { read: false, write: false },
   *   eaas_agreement: { read: false, write: false },
   *   eaas_withdraw: { read: false, write: false },
   *   eaas_deposit: { read: false, write: false },
   *   eaas_brokerage: { read: false, write: false }
   * }
   * *\/
   * ```
   */
  async v2AuthReadPermissions (): Promise<ZodV2AuthReadPermissions.Output> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/r/permissions',
      })
      return ZodV2AuthReadPermissions.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadPermissions', old => old ?? trace)
    }
  }

  /**
   * 取得錢包的資訊。
   * @group v2/auth
   * @returns
   * - type: 錢包類型
   * - currency: 貨幣代碼
   * - balance: 餘額
   * - unsettledInterest: 未結算的資金
   * - availableBalance: 可動用餘額
   * - lastChange: 最後一筆帳目異動的記錄
   * - lastChange.desc: 最後一筆帳目異動的描述
   * @see [Wallets | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-wallets)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log((await bitfinex.v2AuthReadWallets())?.[0])
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * {
   *   availableBalance: 0.00001,
   *   balance: 0.00001,
   *   currency: 'TRX',
   *   lastChange: {},
   *   type: 'exchange',
   *   unsettledInterest: 0
   * }
   * *\/
   * ```
   */
  async v2AuthReadWallets (): Promise<ZodV2AuthReadWallets.Output> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/r/wallets',
      })
      return ZodV2AuthReadWallets.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadWallets', old => old ?? trace)
    }
  }

  /**
   * 取得融資目前的掛單，如果有指定 `currency`，則只會回傳該融資代碼的掛單。如果沒有指定 `currency`，則會回傳全部的掛單。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣代碼
   * @returns
   * - id: 掛單 ID
   * - symbol: 掛單的融資代碼 (fUSD, etc)
   * - currency: 貨幣代碼
   * - mtsCreate: 建立的時間戳
   * - mtsUpdate: 更新的時間戳
   * - amount: 掛單的金額
   * - amountOrig: 掛單的初始金額
   * - type: 掛單類型 (LIMIT, ...)
   * - flags: 合約的相關參數 (TBD)
   * - status: 掛單的狀態 (ACTIVE, PARTIALLY FILLED)
   * - rate: 掛單的利率
   * - period: 掛單的天數
   * - notify: 是否通知
   * - hidden: 是否隱藏
   * - renew: 是否自動續借
   * @see [Active Funding Offers | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-funding-offers)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log((await bitfinex.v2AuthReadFundingOffers())?.[0])
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * {
   *   amount: 1010.5521123,
   *   amountOrig: 1010.5521123,
   *   flags: null,
   *   hidden: false,
   *   id: 3854301834,
   *   mtsCreate: '2025-04-03T04:58:08.000Z',
   *   mtsUpdate: '2025-04-03T04:58:08.000Z',
   *   notify: false,
   *   period: 6,
   *   rate: 0.00039459,
   *   renew: false,
   *   status: 'ACTIVE',
   *   symbol: 'fUSD',
   *   type: 'LIMIT',
   *   currency: 'USD'
   * }
   * *\/
   * ```
   */
  async v2AuthReadFundingOffers (opts: ZodV2AuthReadFundingOffers.Input = {}): Promise<ZodV2AuthReadFundingOffers.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthReadFundingOffers.ZodInput.parse(opts)
      trace.symbol = _.isNil(opts1.currency) ? '' : `/f${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/funding/offers${trace.symbol}`,
      })
      return ZodV2AuthReadFundingOffers.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingOffers', old => old ?? trace)
    }
  }

  /**
   * 取得目前出借中或是借入中的融資記錄。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣代碼，如果未指定則回傳所有貨幣的融資記錄。
   * @returns
   * - id: 融資記錄 ID
   * - symbol: 融資代碼
   * - currency: 貨幣代碼
   * - side: 融資方向，`1` 代表為貸方，`0` 代表同時為貸方與借款人，`-1` 代表為借款人
   * - amount: 融資金額
   * - flags: 融資參數 (目前未定義)
   * - status: 融資狀態 `ACTIVE`
   * - rateType: 融資利率類型，`FIXED` 代表固定利率，`VAR` 代表基於 FRR 浮動利率
   * - rate: 融資利率
   * - period: 融資天數
   * - notify: 是否通知
   * - hidden: 是否隱藏
   * - renew: 是否自動續借
   * - noClose: 在保證金交易被關閉時是否自動結束融資
   * - positionPair: 保證金交易的交易對
   * - mtsOpening: 融資開始時間
   * - mtsLastPayout: 最後一次支付時間
   * - mtsCreate: 建立時間
   * - mtsUpdate: 最後更新時間
   * @see [Funding Credits | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-funding-credits)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log((await bitfinex.v2AuthReadFundingCredits())?.[0])
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * [
   *   {
   *     amount: 1027.10723507,
   *     flags: 0,
   *     hidden: false,
   *     id: 402617569,
   *     mtsCreate: 2025-03-31T08:50:47.000Z,
   *     mtsLastPayout: 1970-01-01T00:00:00.000Z,
   *     mtsOpening: 2025-03-31T08:50:47.000Z,
   *     mtsUpdate: 2025-03-31T08:50:47.000Z,
   *     noClose: false,
   *     notify: false,
   *     period: 2,
   *     positionPair: 'tBTCUST',
   *     rate: 0.00019958,
   *     rateType: 'FIXED',
   *     renew: false,
   *     side: 1,
   *     status: 'ACTIVE',
   *     symbol: 'fUST',
   *     currency: 'UST'
   *   }
   * ]
   * *\/
   * ```
   */
  async v2AuthReadFundingCredits (opts: ZodV2AuthReadFundingCredits.Input = {}): Promise<ZodV2AuthReadFundingCredits.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthReadFundingCredits.ZodInput.parse(opts)
      trace.symbol = _.isNil(opts1.currency) ? '' : `/f${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/funding/credits${trace.symbol}`,
      })
      return ZodV2AuthReadFundingCredits.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingCredits', old => old ?? trace)
    }
  }

  /**
   * 取得指定融資貨幣的自動借出設定
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣代碼
   * @returns
   * - currency: 貨幣代碼
   * - period: 融資天數
   * - rate: 融資利率
   * - amount: 融資最大數量，`0` 代表無限制
   *
   * 若回傳 `null` 代表沒有啟用自動借出。
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log(await bitfinex.v2AuthReadFundingAutoStatus({ currency: 'USD' }))
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * { amount: 0, currency: 'USD', period: 5, rate: 0.00034405 }
   * *\/
   * ```
   */
  async v2AuthReadFundingAutoStatus (opts: ZodV2AuthReadFundingAutoStatus.Input): Promise<ZodV2AuthReadFundingAutoStatus.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthReadFundingAutoStatus.ZodInput.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/r/funding/auto/status',
        body: { currency: opts1.currency },
      })
      return ZodV2AuthReadFundingAutoStatus.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingAutoStatus', old => old ?? trace)
    }
  }

  /**
   * 更新融資貨幣的自動借出設定
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - status: `1` 代表啟用、`0` 代表停用
   * - currency: 貨幣代碼
   * - amount: 融資自動借出的數量，最小為 50 USD 或等值的融資貨幣，`0` 代表無上限
   * - period: 融資天數，預設為 `2`
   * - rate: 融資利率 (單位：百分比)，省略或 `0` 代表套用 FRR 浮動利率
   * @returns
   * - mts: 通知的時間
   * - type: 通知的類型，固定為 `fa-req`
   * - msgId: 訊息 ID
   * - offer.currency: 貨幣代碼
   * - offer.period: 融資天數
   * - offer.rate: 融資利率
   * - offer.threshold: 融資自動借出的數量，`0` 代表無上限
   * - code: W.I.P. (work in progress)
   * - status: 通知的狀態，這個欄位可能會因時而異，可能的值為 `SUCCESS`、`ERROR`、`FAILURE`…
   * - text: 通知的詳細內容
   * @see [Funding Auto-renew | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-funding-auto-renew)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex, FundingAutoStatus } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *
   *     // activate with 0.1% rate
   *     console.log(await bitfinex.v2AuthWriteFundingAuto({ currency: 'BTC', rate: 0.1, period: 2, amount: 0, status: FundingAutoStatus.activate }))
   *     /* Expected output:
   *     {
   *       mts: '2025-03-31T09:06:27.737Z',
   *       type: 'fa-req',
   *       msgId: null,
   *       offer: { currency: 'BTC', period: 2, rate: 0.001, threshold: 0 },
   *       code: null,
   *       status: 'SUCCESS',
   *       text: 'Auto-renew of BTC offers activated at 0.1% a day for 2 days periods'
   *     }
   *     *\/
   *
   *     // activate with FRR
   *     console.log(await bitfinex.v2AuthWriteFundingAuto({ currency: 'BTC', period: 2, amount: 0, status: FundingAutoStatus.activate }))
   *     /* Expected output:
   *     {
   *       mts: '2025-03-31T09:01:56.969Z',
   *       type: 'fa-req',
   *       msgId: null,
   *       offer: { currency: 'BTC', period: 2, rate: 0, threshold: 0 },
   *       code: null,
   *       status: 'SUCCESS',
   *       text: 'Auto-renew of BTC offers activated at FRR for 2 days periods'
   *     }
   *     *\/
   *
   *     // deactivate
   *     console.log(await bitfinex.v2AuthWriteFundingAuto({ currency: 'BTC', status: FundingAutoStatus.deactivate }))
   *     /* Expected output:
   *     {
   *       mts: '2025-03-31T09:01:57.423Z',
   *       type: 'fa-req',
   *       msgId: null,
   *       offer: { currency: 'BTC', period: 2, rate: 0, threshold: 0 },
   *       code: null,
   *       status: 'SUCCESS',
   *       text: 'Auto-renew deactivated for BTC offers'
   *     }
   *     *\/
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   * ```
   */
  async v2AuthWriteFundingAuto (opts: ZodV2AuthWriteFundingAuto.Input): Promise<ZodV2AuthWriteFundingAuto.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthWriteFundingAuto.ZodInput.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/w/funding/auto',
        body: opts1,
      })
      return ZodV2AuthWriteFundingAuto.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthWriteFundingAuto', old => old ?? trace)
    }
  }

  /**
   * 取得已掛單融資的交易記錄。可以用來查詢特定貨幣的融資交易記錄，或是一次取得所有貨幣的融資交易記錄。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣代碼，如果未指定則回傳所有貨幣的融資記錄。
   * - limit: 回傳的交易記錄數量上限。
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: 融資記錄 ID
   * - symbol: 融資代碼
   * - currency: 貨幣代碼
   * - offerId: 融資掛單 ID
   * - amount: 融資金額
   * - rate: 融資利率
   * - period: 融資天數
   * - mtsCreate: 建立時間
   * @see [Funding Trades | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-funding-trades-hist)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log(await bitfinex.v2AuthReadFundingTradesHist({ limit: 1 }))
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * [
   *   {
   *     amount: 1027.10723507,
   *     id: 356904509,
   *     mtsCreate: 2025-03-31T08:50:47.000Z,
   *     offerId: 3850654061,
   *     period: 2,
   *     rate: 0.00019958,
   *     symbol: 'fUST',
   *     currency: 'UST'
   *   }
   * ]
   * *\/
   * ```
   */
  async v2AuthReadFundingTradesHist (opts: ZodV2AuthReadFundingTradesHist.Input = {}): Promise<ZodV2AuthReadFundingTradesHist.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthReadFundingTradesHist.ZodInput.parse(opts)
      trace.symbol = _.isNil(opts1.currency) ? '' : `/f${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/funding/trades${trace.symbol}/hist`,
        body: _.pick(opts1, ['limit', 'start', 'end']),
      })
      return ZodV2AuthReadFundingTradesHist.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingTradesHist', old => old ?? trace)
    }
  }

  /**
   * 取得已結束的融資記錄。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣代碼，如果未指定則回傳所有貨幣的融資記錄
   * - limit: 回傳的融資記錄數量上限，最大 `500`
   * - start: 回傳的融資記錄中，`mts` 欄位不小於此值
   * - end: 回傳的融資記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: 融資記錄 ID
   * - symbol: 融資代碼
   * - currency: 貨幣代碼
   * - side: 融資方向，`1` 代表為貸方，`0` 代表同時為貸方與借款人，`-1` 代表為借款人
   * - amount: 融資金額
   * - flags: 融資參數 (目前未定義)
   * - status: 融資狀態 `CLOSED (expired)`
   * - rateType: 融資利率類型，`FIXED` 代表固定利率，`VAR` 代表基於 FRR 浮動利率
   * - rate: 融資利率
   * - period: 融資天數
   * - notify: 是否通知
   * - hidden: 是否隱藏
   * - renew: 是否自動續借
   * - noClose: 在保證金交易被關閉時是否自動結束融資
   * - positionPair: 保證金交易的交易對
   * - mtsOpening: 融資開始時間
   * - mtsLastPayout: 最後一次支付時間
   * - mtsCreate: 建立時間
   * - mtsUpdate: 最後更新時間
   * @see [Funding Credits History | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-funding-credits-hist)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log(await bitfinex.v2AuthReadFundingCreditsHist({ limit: 1 }))
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * [
   *   {
   *     amount: 850.29527051,
   *     flags: null,
   *     hidden: false,
   *     id: 402392161,
   *     mtsCreate: 2025-03-27T00:50:47.000Z,
   *     mtsLastPayout: 2025-03-31T00:51:03.000Z,
   *     mtsOpening: 2025-03-27T00:50:47.000Z,
   *     mtsUpdate: 2025-03-30T19:28:55.000Z,
   *     noClose: false,
   *     notify: false,
   *     period: 4,
   *     positionPair: 'tBTCUST',
   *     rate: 0.00031771,
   *     rateType: 'FIXED',
   *     renew: false,
   *     side: 1,
   *     status: 'CLOSED (expired)',
   *     symbol: 'fUST',
   *     currency: 'UST'
   *   }
   * ]
   * *\/
   * ```
   */
  async v2AuthReadFundingCreditsHist (opts: ZodV2AuthReadFundingCreditsHist.Input = {}): Promise<ZodV2AuthReadFundingCreditsHist.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthReadFundingCreditsHist.ZodInput.parse(opts)
      trace.symbol = _.isNil(opts1.currency) ? '' : `/f${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/funding/credits${trace.symbol}/hist`,
        body: _.pick(opts1, ['limit', 'start', 'end']),
      })
      return ZodV2AuthReadFundingCreditsHist.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingCreditsHist', old => old ?? trace)
    }
  }

  /**
   * 查看過去的分類帳記錄。預設會返回最近的記錄，但可以使用時間戳來檢索特定時間的數據，最長可以取得六年內的記錄。
   * @group v2/auth/ledgers
   * @param opts - 參數說明
   * - currency: 融姿代碼，如果未指定則回傳所有貨幣的分類帳記錄
   * - category: 記錄類別，如果未指定則回傳所有類別的分類帳記錄
   * - limit: 回傳的分類帳記錄數量上限，最大 `2500`
   * - start: 回傳的分類帳記錄中，`mts` 欄位不小於此值
   * - end: 回傳的分類帳記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: Ledger ID
   * - currency: 貨幣代碼
   * - wallet: 錢包類型
   * - mts: 記錄時間
   * - amount: 異動金額
   * - balance: 變更後的餘額
   * - description: 描述
   * @see [Ledgers | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-ledgers)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex, LedgersHistCategory } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log(await bitfinex.v2AuthReadLedgersHist({ category: LedgersHistCategory.MarginSwapInterestPayment, limit: 1 }))
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * [
   *   {
   *     amount: 0.20089545,
   *     balance: 1009.89393076,
   *     currency: 'USD',
   *     description: 'Margin Funding Payment on wallet funding',
   *     id: 9784673670,
   *     mts: 2025-03-31T01:30:13.000Z,
   *     wallet: 'funding'
   *   }
   * ]
   * *\/
   * ```
   */
  async v2AuthReadLedgersHist (opts: ZodV2AuthReadLedgersHist.Input = {}): Promise<ZodV2AuthReadLedgersHist.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthReadLedgersHist.ZodInput.parse(opts)
      trace.currency = _.isNil(opts1.currency) ? '' : `/${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/ledgers${trace.currency}/hist`,
        body: _.pick(opts1, ['category', 'limit', 'start', 'end']),
      })
      return ZodV2AuthReadLedgersHist.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadLedgersHist', old => old ?? trace)
    }
  }

  /**
   * 取消全部的融資掛單，如果有指定貨幣時，則只取消該貨幣全部的融資掛單。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣代碼
   * @returns
   * - mts: 通知的時間
   * - type: 通知的類型，固定為 `foc_all-req` (funding offer cancel all request)
   * - status: 通知的狀態，這個欄位可能會因時而異，可能的值為 `SUCCESS`、`ERROR`、`FAILURE`…
   * - text: 通知的詳細內容
   * @see [Cancel All Funding Offers | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-cancel-all-funding-offers)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log(await bitfinex.v2AuthWriteFundingOfferCancelAll({ currency: 'BTC' }))
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * {
   *   mts: 2025-03-31T09:13:21.649Z,
   *   type: 'foc_all-req',
   *   status: 'SUCCESS',
   *   text: 'None to cancel'
   * }
   * *\/
   * ```
   */
  async v2AuthWriteFundingOfferCancelAll (opts: ZodV2AuthWriteFundingOfferCancelAll.Input = {}): Promise<ZodV2AuthWriteFundingOfferCancelAll.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthWriteFundingOfferCancelAll.ZodInput.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/w/funding/offer/cancel/all',
        body: _.pick(opts1, ['currency']),
      })
      return ZodV2AuthWriteFundingOfferCancelAll.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthWriteFundingOfferCancelAll', old => old ?? trace)
    }
  }

  /**
   * 取得帳戶指定貨幣的融資資訊
   * @group v2/auth/info
   * @param opts - 參數說明
   * - currency: 貨幣代碼，預設為 `USD`
   * @returns
   * - currency: 貨幣代碼
   * - symbol: 融資代碼
   * - yieldLoan: 借貸利率的加權平均
   * - yieldLend: 放貸利率的加權平均
   * - durationLoan: 借貸天數的加權平均
   * - durationLend: 放貸天數的加權平均
   * @see [Funding Info | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-info-funding)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log(await bitfinex.v2AuthReadInfoFunding({ currency: 'USD' }))
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   *
   * /* Expected output:
   * {
   *   symbol: 'fUSD',
   *   yieldLoan: 0,
   *   yieldLend: 0.00022886,
   *   durationLoan: 0,
   *   durationLend: 0.5785416666666667,
   *   currency: 'USD'
   * }
   * *\/
   * ```
   */
  async v2AuthReadInfoFunding (opts: ZodV2AuthReadInfoFunding.Input = {}): Promise<ZodV2AuthReadInfoFunding.Output> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = ZodV2AuthReadInfoFunding.ZodInput.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/info/funding/f${opts1.currency}`,
      })
      return ZodV2AuthReadInfoFunding.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadInfoFunding', old => old ?? trace)
    }
  }

  /**
   * 取得重要的帳戶資訊
   * @group v2/auth/info
   * @returns
   * - company: 代表此帳戶在何處註冊；在 Bitfinex 註冊的帳戶會顯示 'bitfinex'，在 eosfinex 註冊的帳戶會顯示 'eosfinex'
   * - compCountries: 根據你的驗證資料（居住地及國籍）所產生的國家代碼陣列
   * - compCountriesResid: 根據你的驗證資料（居住地）所產生的國家代碼陣列
   * - competitionEnabled: 代表此帳戶是否啟用 competition
   * - complAccountType: 合規驗證類型 (`"individual"` 或 `"corporate"`)
   * - ctxSwitch.allowDisable: 帳戶是否可停用由主帳戶切換至此帳戶的功能
   * - ctxSwitch.disabled: 是否禁止主帳戶切換到此帳戶
   * - email: 帳戶的 email
   * - id: 帳戶 ID
   * - locale: 帳戶的語系設定
   * - masterAccount
   *     - masterAccount.groupId: 帳戶群組 ID
   *     - masterAccount.groupWithdrawEnabled: 是否啟用群組提領
   *     - masterAccount.id: 主帳戶的 ID（若此帳戶為子帳戶）
   *     - masterAccount.inheritVerification: 代表此帳戶是否繼承主帳戶的驗證
   *     - masterAccount.isGroupMaster: 代表此帳戶是否為群組主帳戶
   *     - masterAccount.mtsCreate: 主帳戶建立的時間戳
   * - merchant
   *     - merchant.enabled: 代表此帳戶是否為商家帳戶
   *     - merchant.isEnterprise: 代表此帳戶是否為企業商家帳戶
   * - modes2FA: 已啟用的二階段驗證種類（包含 'u2f', 'otp'）
   * - mtsAccountCreate: 帳戶建立的時間戳
   * - pptEnabled: 代表此帳戶是否啟用模擬交易
   * - securities
   *     - securities.enabled: 代表此帳戶是否為證券帳戶
   *     - securities.isElSalvador: 代表此帳戶是否已通過薩爾瓦多證券相關驗證
   *     - securities.isInvestorAccredited: 代表此帳戶是否已通過合格投資人證券驗證
   *     - securities.isMaster: 代表此帳戶是否擁有證券子帳戶
   * - timeLastLogin: 上次登入的時間戳
   * - timezone: 帳戶的時區設定
   * - username: 帳戶的使用者名稱
   * - verification
   *     - verification.email: 代表此電子郵件是否已驗證
   *     - verification.level: 帳戶的驗證等級
   *     - verification.levelSubmitted: 該帳戶已提交的最高驗證申請等級
   *     - verification.verified: 代表使用者是否為已驗證（KYC）狀態
   * @see [User Info | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-info-user)
   * @example
   * ```js
   * apiKey = 'apiKey'
   * apiSecret = 'apiSecret'
   *
   * await (async () => {
   *   try {
   *     const { Bitfinex } = require('@taichunmin/bitfinex')
   *     const bitfinex = new Bitfinex({ apiKey, apiSecret })
   *     console.log(await bitfinex.v2AuthReadInfoUser())
   *   } catch (err) {
   *     console.log(err)
   *   }
   * })()
   * ```
   */
  async v2AuthReadInfoUser (): Promise<ZodV2AuthReadInfoUser.Output> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/r/info/user',
      })
      return ZodV2AuthReadInfoUser.parseOutput(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadInfoUser', old => old ?? trace)
    }
  }
}
