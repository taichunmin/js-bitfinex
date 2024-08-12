import axios, { type AxiosResponse } from 'axios'
import { createHmac } from 'crypto'
import _ from 'lodash'
import * as zod from './zod'

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
   * @returns
   * - status: operative = 1, maintenance = 0
   * @see [Platform Status | BitFinex API](https://docs.bitfinex.com/reference/rest-public-platform-status)
   */
  static async v2PlatformStatus (): Promise<zod.OutputV2PlatformStatus> {
    return zod.ZodOutputV2PlatformStatus.parse(await Bitfinex.#apiGetPub({
      path: 'v2/platform/status',
    }))
  }

  /**
   * 取得指定交易對的成交記錄。
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
    const opts1 = zod.ZodInputV2TradesTradingHist.parse(opts)
    return zod.ZodOutputV2TradesTradingHist.parse(await Bitfinex.#apiGetPub({
      path: `v2/trades/t${opts1.pair}/hist`,
      query: _.pick(opts1, ['limit', 'sort', 'start', 'end']),
    }))
  }

  /**
   * 取得指定貨幣的融資成交記錄。
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
    const opts1 = zod.ZodInputV2TradesFundingHist.parse(opts)
    return zod.ZodOutputV2TradesFundingHist.parse(await Bitfinex.#apiGetPub({
      path: `v2/trades/f${opts1.currency}/hist`,
      query: _.pick(opts1, ['limit', 'sort', 'start', 'end']),
    }))
  }

  /**
   * 取得目前 apiKey 或 token 的權限。
   * @returns 回傳結果的範例如下：
   *
   * ```json
   * {
   *   "account": { "read": 0, "write": 0 },
   *   "history": { "read": 1, "write": 0 },
   *   "orders": { "read": 0, "write": 0 },
   *   "positions": { "read": 0, "write": 0 },
   *   "funding": { "read": 1, "write": 1 },
   *   "settings": { "read": 0, "write": 0 },
   *   "wallets": { "read": 1, "write": 0 },
   *   "withdraw": { "read": 0, "write": 0 },
   *   "ui_withdraw": { "read": 0, "write": 0 },
   *   "bfxpay": { "read": 0, "write": 0 },
   *   "eaas_agreement": { "read": 0, "write": 0 },
   *   "eaas_withdraw": { "read": 0, "write": 0 },
   *   "eaas_deposit": { "read": 0, "write": 0 },
   *   "eaas_brokerage": { "read": 0, "write": 0 }
   * }
   * ```
   *
   * 其中，`0` 代表無權限，`1` 代表有權限。
   * @see [Key Permissions | BitFinex API](https://docs.bitfinex.com/reference/key-permissions)
   */
  async v2AuthReadPermissions (): Promise<zod.OutputV2AuthReadPermissions> {
    return zod.ZodOutputV2AuthReadPermissions.parse(await this.#apiPostAuth({
      path: 'v2/auth/r/permissions',
    }))
  }

  /**
   * 取得錢包的資訊。
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
    return zod.ZodOutputV2AuthReadWallets.parse(await this.#apiPostAuth({
      path: 'v2/auth/r/wallets',
    }))
  }
}
