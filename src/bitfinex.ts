import axios, { type AxiosResponse } from 'axios'
import { createHmac } from 'crypto'
import _ from 'lodash'
import * as enums from './enums'
import * as zod from './zod'

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
   */
  static async v2PlatformStatus (): Promise<zod.OutputV2PlatformStatus> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'v2/platform/status',
      })
      return zod.ZodOutputV2PlatformStatus.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2PlatformStatus', old => old ?? trace)
    }
  }

  static async v2Config (): Promise<Record<enums.V2ConfigRequest, zod.JsonValue[]>>
  static async v2Config (req: enums.V2ConfigRequest): Promise<zod.JsonValue[]>
  static async v2Config <TReq extends enums.V2ConfigRequest> (reqs: TReq[]): Promise<Record<TReq, zod.JsonValue[]>>

  /**
   * 取得指定的 Bifinex 設定檔。
   * @group v2
   * @param reqOrReqs - 設定檔的名稱，如果帶入陣列可以一次取得多個設定檔。
   * @returns Bifinex 設定檔的內容。
   * @see [Configs | BitFinex API](https://docs.bitfinex.com/reference/rest-public-conf)
   */
  static async v2Config (reqOrReqs?: any): Promise<any> {
    const trace: Record<string, any> = { reqs: reqOrReqs }
    try {
      const reqs = trace.reqs = zod.ZodInputV2Config.parse(_.isString(reqOrReqs) ? [reqOrReqs] : reqOrReqs) ?? V2ConfigRequestConst
      trace.resp = await Bitfinex.#apiGetPub<zod.JsonValue[][]>({
        path: `v2/conf/${reqs.join(',')}`,
      })
      return _.isString(reqOrReqs) ? _.first(trace.resp) : _.zipObject(reqs, trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Config', old => old ?? trace)
    }
  }

  /**
   * 取得指定交易對的成交記錄。
   * @group v2/trades
   * @param opts - 參數說明
   * - pair: 交易對，預設為 `BTCUSD`
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
   */
  static async v2TradesTradingHist (opts: zod.InputV2TradesTradingHist = {}): Promise<zod.OutputV2TradesTradingHist> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2TradesTradingHist.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/trades/t${opts1.pair}/hist`,
        query: _.pick(opts1, ['limit', 'sort', 'start', 'end']),
      })
      return zod.ZodOutputV2TradesTradingHist.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2TradesTradingHist', old => old ?? trace)
    }
  }

  /**
   * 取得指定貨幣的融資成交記錄。
   * @group v2/trades
   * @param opts - 參數說明
   * - currency: 貨幣，預設為 `USD`
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
   */
  static async v2TradesFundingHist (opts: zod.InputV2TradesFundingHist = {}): Promise<zod.OutputV2TradesFundingHist> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2TradesFundingHist.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/trades/f${opts1.currency}/hist`,
        query: _.pick(opts1, ['limit', 'sort', 'start', 'end']),
      })
      return zod.ZodOutputV2TradesFundingHist.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2TradesFundingHist', old => old ?? trace)
    }
  }

  /**
   * 取得 Bitfinex 所有交易對的詳細資訊。
   * @group v1
   * @returns
   * - pair: 交易對
   * - price_precision: 價格小數點精確度
   * - initial_margin: 初始保證金百分比
   * - minimum_margin: 最低保證金百分比
   * - maximum_order_size: 最大訂單量
   * - minimum_order_size: 最小訂單量
   * - expiration: 過期時間
   * - margin: 保證金交易是否可用
   */
  static async v1SymbolsDetails (): Promise<zod.OutputV1SymbolsDetails> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'https://api.bitfinex.com/v1/symbols_details',
      })
      return zod.ZodOutputV1SymbolsDetails.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v1SymbolsDetails', old => old ?? trace)
    }
  }

  /**
   * 取得指定交易對 `pair` 的 K 線圖。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - pair: 交易對，預設為 `BTCUSD`
   * - section: `hist` 代表歷史記錄，`last` 代表最新資料，預設為 `hist`
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
   */
  static async v2Candles (opts?: zod.z.input<typeof zod.ZodInputV2CandlesPair>): Promise<zod.OutputV2Candles>

  /**
   * 取得指定融資貨幣 `currency` 的 K 線圖。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - currency: 貨幣，預設為 `USD`
   * - period: 融資天數，預設為 2
   * - section: `hist` 代表歷史記錄，`last` 代表最新資料，預設為 `hist`
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
   */
  static async v2Candles (opts?: zod.z.input<typeof zod.ZodInputV2CandlesCurrencyPeriod1>): Promise<zod.OutputV2Candles>

  /**
   * 取得指定融資貨幣 `currency` 的 K 線圖。
   * @group v2/candles
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - currency: 貨幣，預設為 `USD`
   * - periodStart: 融資天數的開始範圍
   * - periodEnd: 融資天數的結束範圍
   * - aggregation: 資料聚合的方式，可指定 `10` 或 `30`，預設為 `30`
   * - section: `hist` 代表歷史記錄，`last` 代表最新資料，預設為 `hist`
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
   */
  static async v2Candles (opts?: zod.z.input<typeof zod.ZodInputV2CandlesCurrencyPeriod2>): Promise<zod.OutputV2Candles>

  static async v2Candles (opts: any = {}): Promise<zod.OutputV2Candles> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2Candles.parse(opts) as zod.z.output<typeof zod.ZodInputV2Candles> & Record<string, undefined>
      if (_.isString(opts1.pair)) trace.candle = `trade:${opts1.timeframe}:t${opts1.pair}`
      else if (_.isString(opts1.currency)) trace.candle = `trade:${opts1.timeframe}:f${opts1.currency}:${opts1.period}`
      if (!_.isString(trace.candle)) throw new Error('invalid pair or currency')
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/candles/${trace.candle}/${opts1.section}`,
        query: _.omitBy<any>(_.pick(opts1, ['sort', 'start', 'end', 'limit']), _.isNil),
      })
      return zod.ZodOutputV2Candles.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Candles', old => old ?? trace)
    }
  }

  /**
   * 取得指定貨幣最近的融資統計記錄
   * @group v2/funding
   * @param opts - 參數說明
   * - currency: 貨幣，預設為 `USD`
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
   */
  static async v2FundingStatsHist (opts: zod.InputV2FundingStatsHist = {}): Promise<zod.OutputV2FundingStatsHist> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2FundingStatsHist.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/funding/stats/f${opts1.currency}/hist`,
        query: _.pick(opts1, ['limit', 'start', 'end']),
      })
      return zod.ZodOutputV2FundingStatsHist.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2FundingStatsHist', old => old ?? trace)
    }
  }

  /**
   * 取得交易對以及融資目前的行情概覽。它會回傳當前最佳買入價和賣出價、最近成交價，以及昨日至今的每日成交量和價格變動資訊。並允許同時取得多個交易對及融資的行情資訊。
   * @group v2/tickers
   * @param opts - 參數說明
   * - symbols: 交易對或融資代碼的陣列，或指定 ALL 取得全部的行情概覽，預設為 `ALL`。
   * @returns
   * - 交易對的行情概覽欄位
   *     - symbol: 交易對代碼
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
   */
  static async v2Tickers (opts: zod.InputV2Tickers = {}): Promise<zod.OutputV2Tickers> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2Tickers.parse(opts)
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'v2/tickers',
        query: { symbols: opts1.symbols },
      })
      return zod.ZodOutputV2Tickers.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Tickers', old => old ?? trace)
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
   */
  static async v2IntGeoIp (): Promise<zod.OutputV2IntGeoIp> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await Bitfinex.#apiGetPub({
        path: 'v2/int/geo/ip',
      })
      return zod.ZodOutputV2IntGeoIp.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2IntGeoIp', old => old ?? trace)
    }
  }

  /**
   * 取得目前 apiKey 或 token 的權限。
   * @group v2/auth
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
   * @see [Key Permissions | BitFinex API](https://docs.bitfinex.com/reference/key-permissions)
   */
  async v2AuthReadPermissions (): Promise<zod.OutputV2AuthReadPermissions> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/r/permissions',
      })
      return zod.ZodOutputV2AuthReadPermissions.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadPermissions', old => old ?? trace)
    }
  }

  /**
   * 取得錢包的資訊。
   * @group v2/auth
   * @returns
   * - type: 錢包類型
   * - currency: 貨幣
   * - balance: 餘額
   * - unsettledInterest: 未結算的資金
   * - availableBalance: 可動用餘額
   * - lastChange: 最後一筆帳目異動的記錄
   * - lastChange.desc: 最後一筆帳目異動的描述
   * @see [Wallets | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-wallets)
   */
  async v2AuthReadWallets (): Promise<zod.OutputV2AuthReadWallets> {
    const trace: Record<string, any> = {}
    try {
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/r/wallets',
      })
      return zod.ZodOutputV2AuthReadWallets.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadWallets', old => old ?? trace)
    }
  }

  /**
   * 取得目前出借中或是借入中的融資記錄。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣，如果未指定則回傳所有貨幣的融資記錄。
   * @returns
   * - id: 融資記錄 ID
   * - symbol: 貨幣符號
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
   */
  async v2AuthReadFundingCredits (opts: zod.InputV2AuthReadFundingCredits = {}): Promise<zod.OutputV2AuthReadFundingCredits> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthReadFundingCredits.parse(opts)
      trace.symbol = _.isNil(opts1.currency) ? '' : `/f${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/funding/credits${trace.symbol}`,
      })
      return zod.ZodOutputV2AuthReadFundingCredits.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingCredits', old => old ?? trace)
    }
  }

  /**
   * 取得指定融資貨幣的自動借出設定
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣
   * @returns
   * - currency: 貨幣
   * - period: 融資天數
   * - rate: 融資利率
   * - amount: 融資最大數量，`0` 代表無限制
   *
   * 若回傳 `null` 代表沒有啟用自動借出。
   */
  async v2AuthReadFundingAutoStatus (opts: zod.InputV2AuthReadFundingAutoStatus = {}): Promise<zod.OutputV2AuthReadFundingAutoStatus> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthReadFundingAutoStatus.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/r/funding/auto/status',
        body: { currency: opts1.currency },
      })
      return zod.ZodOutputV2AuthReadFundingAutoStatus.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingAutoStatus', old => old ?? trace)
    }
  }

  /**
   * 更新融資貨幣的自動借出設定
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - status: `1` 代表啟用、`0` 代表停用
   * - currency: 貨幣
   * - amount: 融資自動借出的數量，最小為 50 USD 或等值的融資貨幣，`0` 代表無上限
   * - period: 融資天數，預設為 `2`
   * - rate: 融資利率 (單位：百分比)，省略或 `0` 代表套用 FRR 浮動利率
   * @returns
   * - mts: 通知的時間
   * - type: 通知的類型，固定為 `fa-req`
   * - msgId: 訊息 ID
   * - offer.currency: 貨幣
   * - offer.period: 融資天數
   * - offer.rate: 融資利率
   * - offer.threshold: 融資自動借出的數量，`0` 代表無上限
   * - code: W.I.P. (work in progress)
   * - status: 通知的狀態，這個欄位可能會因時而異，可能的值為 `SUCCESS`、`ERROR`、`FAILURE`…
   * - text: 通知的詳細內容
   */
  async v2AuthWriteFundingAuto (opts: zod.InputV2AuthWriteFundingAuto): Promise<zod.OutputV2AuthWriteFundingAuto> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthWriteFundingAuto.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/w/funding/auto',
        body: opts1,
      })
      return zod.ZodOutputV2AuthWriteFundingAuto.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthWriteFundingAuto', old => old ?? trace)
    }
  }

  /**
   * 取得已掛單融資的交易記錄。可以用來查詢特定貨幣的融資交易記錄，或是一次取得所有貨幣的融資交易記錄。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣，如果未指定則回傳所有貨幣的融資記錄。
   * - limit: 回傳的交易記錄數量上限。
   * - start: 回傳的交易記錄中，`mts` 欄位不小於此值
   * - end: 回傳的交易記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: 融資記錄 ID
   * - symbol: 貨幣符號
   * - offerId: 融資掛單 ID
   * - amount: 融資金額
   * - rate: 融資利率
   * - period: 融資天數
   * - mtsCreate: 建立時間
   * @see [Funding Trades | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-funding-trades-hist)
   */
  async v2AuthReadFundingTradesHist (opts: zod.InputV2AuthReadFundingTradesHist = {}): Promise<zod.OutputV2AuthReadFundingTradesHist> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthReadFundingTradesHist.parse(opts)
      trace.symbol = _.isNil(opts1.currency) ? '' : `/f${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/funding/trades${trace.symbol}/hist`,
        body: _.pick(opts1, ['limit', 'start', 'end']),
      })
      return zod.ZodOutputV2AuthReadFundingTradesHist.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingTradesHist', old => old ?? trace)
    }
  }

  /**
   * 取得已結束的融資記錄。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣，如果未指定則回傳所有貨幣的融資記錄
   * - limit: 回傳的融資記錄數量上限，最大 `500`
   * - start: 回傳的融資記錄中，`mts` 欄位不小於此值
   * - end: 回傳的融資記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: 融資記錄 ID
   * - symbol: 貨幣符號
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
   */
  async v2AuthReadFundingCreditsHist (opts: zod.InputV2AuthReadFundingCreditsHist = {}): Promise<zod.OutputV2AuthReadFundingCreditsHist> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthReadFundingCreditsHist.parse(opts)
      trace.symbol = _.isNil(opts1.currency) ? '' : `/f${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/funding/credits${trace.symbol}/hist`,
        body: _.pick(opts1, ['limit', 'start', 'end']),
      })
      return zod.ZodOutputV2AuthReadFundingCreditsHist.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadFundingCreditsHist', old => old ?? trace)
    }
  }

  /**
   * 查看過去的分類帳記錄。預設會返回最近的記錄，但可以使用時間戳來檢索特定時間的數據，最長可以取得六年內的記錄。
   * @group v2/auth/ledgers
   * @param opts - 參數說明
   * - currency: 貨幣，如果未指定則回傳所有貨幣的分類帳記錄
   * - category: 記錄類別，如果未指定則回傳所有類別的分類帳記錄
   * - limit: 回傳的分類帳記錄數量上限，最大 `2500`
   * - start: 回傳的分類帳記錄中，`mts` 欄位不小於此值
   * - end: 回傳的分類帳記錄中，`mts` 欄位不大於此值
   * @returns
   * - id: Ledger ID
   * - currency: 貨幣
   * - wallet: 錢包類型
   * - mts: 記錄時間
   * - amount: 異動金額
   * - balance: 變更後的餘額
   * - description: 描述
   * @see [Ledgers | BitFinex API](https://docs.bitfinex.com/reference/rest-auth-ledgers)
   */
  async v2AuthReadLedgersHist (opts: zod.InputV2AuthReadLedgersHist = {}): Promise<zod.OutputV2AuthReadLedgersHist> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthReadLedgersHist.parse(opts)
      trace.currency = _.isNil(opts1.currency) ? '' : `/${opts1.currency}`
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/ledgers${trace.currency}/hist`,
        body: _.pick(opts1, ['category', 'limit', 'start', 'end']),
      })
      return zod.ZodOutputV2AuthReadLedgersHist.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadLedgersHist', old => old ?? trace)
    }
  }

  /**
   * 取消全部的融資掛單，如果有指定貨幣時，則只取消該貨幣全部的融資掛單。
   * @group v2/auth/funding
   * @param opts - 參數說明
   * - currency: 貨幣
   * @returns
   * - mts: 通知的時間
   * - type: 通知的類型，固定為 `foc_all-req` (funding offer cancel all request)
   * - status: 通知的狀態，這個欄位可能會因時而異，可能的值為 `SUCCESS`、`ERROR`、`FAILURE`…
   * - text: 通知的詳細內容
   */
  async v2AuthWriteFundingOfferCancelAll (opts: zod.InputV2AuthWriteFundingOfferCancelAll = {}): Promise<zod.OutputV2AuthWriteFundingOfferCancelAll> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthWriteFundingOfferCancelAll.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: 'v2/auth/w/funding/offer/cancel/all',
        body: _.pick(opts1, ['currency']),
      })
      return zod.ZodOutputV2AuthWriteFundingOfferCancelAll.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthWriteFundingOfferCancelAll', old => old ?? trace)
    }
  }

  /**
   * 取得帳戶指定貨幣的融資資訊
   * @group v2/auth/info
   * @param opts - 參數說明
   * - currency: 貨幣，預設為 `USD`
   * @returns
   * - currency: 貨幣
   * - symbol: 貨幣 symbol
   * - yieldLoan: 借貸利率的加權平均
   * - yieldLend: 放貸利率的加權平均
   * - durationLoan: 借貸天數的加權平均
   * - durationLend: 放貸天數的加權平均
   */
  async v2AuthReadInfoFunding (opts: zod.InputV2AuthReadInfoFunding = {}): Promise<zod.OutputV2AuthReadInfoFunding> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2AuthReadInfoFunding.parse(opts)
      trace.resp = await this.#apiPostAuth({
        path: `v2/auth/r/info/funding/f${opts1.currency}`,
      })
      return zod.ZodOutputV2AuthReadInfoFunding.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2AuthReadInfoFunding', old => old ?? trace)
    }
  }
}
