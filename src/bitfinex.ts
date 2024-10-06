import axios, { type AxiosResponse } from 'axios'
import { createHmac } from 'crypto'
import _ from 'lodash'
import * as zod from './zod'
import * as enums from './enums'

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
   * @param reqOrReqs - 設定檔的名稱，如果帶入陣列可以一次取得多個設定檔。
   * @returns Bifinex 設定檔的內容。
   * @see [Configs | BitFinex API](https://docs.bitfinex.com/reference/rest-public-conf)
   */
  static async v2Config (reqOrReqs?: any): Promise<any> {
    const trace: Record<string, any> = { reqs: reqOrReqs }
    try {
      const reqs = trace.reqs = zod.ZodInputV2Config.parse(_.isString(reqOrReqs) ? [reqOrReqs] : reqOrReqs) ?? enums.V2ConfigRequestConst
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
   * 取得融資的 K 線圖。
   * @param opts - 參數說明
   * - timeframe: 時間框架，預設為 `1h`
   * - pair: 交易對，預設為 `BTCUSD`
   * - currency: 貨幣，預設為 `USD`
   * - period: 融資天數，預設為 2
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
   * - open: 開盤價
   * - close: 收盤價
   * - high: 最高價
   * - low: 最低價
   * - volume: 成交量
   * @see [Candles | BitFinex API](https://docs.bitfinex.com/reference/rest-public-candles)
   */
  static async v2Candles (opts: zod.InputV2Candles = {}): Promise<zod.OutputV2Candles> {
    const trace: Record<string, any> = { opts }
    try {
      const opts1 = trace.opts = zod.ZodInputV2Candles.parse(opts)
      if (_.isString(opts1.pair)) trace.candle = `trade:${opts1.timeframe}:t${opts1.pair}`
      else if (_.isString(opts1.currency)) trace.candle = `trade:${opts1.timeframe}:f${opts1.currency}:${opts1.period}`
      if (!_.isString(trace.candle)) throw new Error('invalid pair or currency')
      trace.resp = await Bitfinex.#apiGetPub({
        path: `v2/candles/${trace.candle}/${opts1.section}`,
      })
      console.log(trace.resp)
      return zod.ZodOutputV2Candles.parse(trace.resp)
    } catch (err) {
      throw _.update(err, 'data.v2Candles', old => old ?? trace)
    }
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
   * @param opts - 參數說明
   * - currency: 貨幣。
   * @returns
   * - currency: 貨幣
   * - period: 融資天數
   * - rate: 融資利率
   * - amount: 融資最大數量，`0` 代表無限制
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
   * 取得已掛單融資的交易記錄。可以用來查詢特定貨幣的融資交易記錄，或是一次取得所有貨幣的融資交易記錄。
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
}
