import _ from 'lodash'
import { z } from 'zod'
import * as enums from './enums'
import * as utils from './utils'

export * from 'zod'

export type JsonArray = JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

// JSON type: https://zod.dev/?id=json-type
export const ZodJsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()])
export const ZodJsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  ZodJsonPrimitive,
  z.array(ZodJsonValue),
  z.record(ZodJsonValue),
]))
export const ZodJsonObject = z.record(ZodJsonValue)
export const ZodJsonArray = z.array(ZodJsonValue)

export const ZodAnyToUndefined = z.any().transform(() => undefined)

// enums
export const ZodBitfinexSort = z.nativeEnum(enums.BitfinexSort)

// transforms
function transformMts (val: Date): number {
  return val instanceof Date ? val.getTime() : val
}

// v2PlatformStatus
export const ZodOutputV2PlatformStatus = z.tuple([
  z.nativeEnum(enums.PlatformStatus), // 1: operative, 0: maintenance
]).transform(([status]) => ({ status }))
export type OutputV2PlatformStatus = z.output<typeof ZodOutputV2PlatformStatus>

// v2TradesHist
const ZodInputV2TradesHistBase = z.object({
  limit: z.number().int().max(10000).default(125),
  sort: ZodBitfinexSort.default(enums.BitfinexSort.DESC),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
})
export const ZodInputV2TradesHistPair = ZodInputV2TradesHistBase.extend({
  pair: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(obj => ({ ...obj, symbol: `t${obj.pair}` }))
export type InputV2TradesHistPair = z.input<typeof ZodInputV2TradesHistPair>
export const ZodInputV2TradesHistCurrency = ZodInputV2TradesHistBase.extend({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(obj => ({ ...obj, symbol: `f${obj.currency}` }))
export type InputV2TradesHistCurrency = z.input<typeof ZodInputV2TradesHistCurrency>
export const ZodInputV2TradesHistSymbol = ZodInputV2TradesHistBase.extend({
  symbol: z.string().trim().regex(/^[\w:]+$/),
})
export type InputV2TradesHistSymbol = z.input<typeof ZodInputV2TradesHistSymbol>
export const ZodInputV2TradesHist = z.union([
  ZodInputV2TradesHistPair,
  ZodInputV2TradesHistCurrency,
  ZodInputV2TradesHistSymbol,
])
export type InputV2TradesHist = z.input<typeof ZodInputV2TradesHist>
export const ZodOutputV2TradesHistPair = z.array(z.tuple([
  z.number().int(), // ID of the trade
  z.number().int(), // Millisecond epoch timestamp
  z.number(), // How much was bought (positive) or sold (negative)
  z.number(), // Price at which the trade was executed
]).transform(([id, mts, amount, price]) => ({ id, mts: new Date(mts), amount, price })))
export type OutputV2TradesHistPair = z.output<typeof ZodOutputV2TradesHistPair>
export const ZodOutputV2TradesHistCurrency = z.array(z.tuple([
  z.number().int(), // ID of the trade
  z.number().int(), // Millisecond epoch timestamp
  z.number(), // How much was bought (positive) or sold (negative)
  z.number(), // Rate at which funding transaction occurred
  z.number().int(), // Amount of time the funding transaction was for
]).transform(([id, mts, amount, rate, period]) => ({ id, mts: new Date(mts), amount, rate, period })))
export type OutputV2TradesHistCurrency = z.output<typeof ZodOutputV2TradesHistCurrency>
export const ZodOutputV2TradesHist = z.union([
  ZodOutputV2TradesHistPair,
  ZodOutputV2TradesHistCurrency,
])
export type OutputV2TradesHist = z.output<typeof ZodOutputV2TradesHist>

// v2AuthReadPermissions
/** @inline */
export const ZodOutputV2AuthReadPermissions = z.array(z.tuple([
  z.string(), // Api scope
  z.coerce.boolean(), // Read permission: false = 0, true = 1
  z.coerce.boolean(), // Write permission: false = 0, true = 1
])).transform(perms => {
  const transformed: Record<string, { read: boolean, write: boolean }> = {}
  for (const [scope, read, write] of perms) transformed[scope] = { read, write }
  return transformed
})
export type OutputV2AuthReadPermissions = z.output<typeof ZodOutputV2AuthReadPermissions>

// v2AuthReadWallets
const ZodOutputV2AuthReadWallet = z.tuple([
  z.string(), // Wallet name (exchange, margin, funding)
  z.string(), // Currency (e.g. USD, BTC, ETH, ...)
  z.number(), // Balance
  z.number(), // Unsettled interest
  z.number(), // Wallet balance available for orders/withdrawal/transfer
  z.string().nullable(), // Description of the last ledger entry
  ZodJsonObject.nullable(), // Optional object with details of LAST_CHANGE
]).transform(([type, currency, balance, unsettledInterest, availableBalance, lastChangeDesc, lastChange]) => {
  const tmp = _.omitBy({ ...(lastChange ?? {}), desc: lastChangeDesc }, _.isNil) as Record<string, JsonValue> & { desc: string }
  return { type, currency, balance, unsettledInterest, availableBalance, lastChange: tmp }
})
export const ZodOutputV2AuthReadWallets = z.array(ZodOutputV2AuthReadWallet)
export type OutputV2AuthReadWallets = z.output<typeof ZodOutputV2AuthReadWallets>

// v2Config
export const ZodInputV2Config = z.array(z.string().trim().regex(/^[\w:]+$/)).min(1).or(ZodAnyToUndefined)

// v1SymbolsDetails
export const ZodOutputV1SymbolsDetails = z.array(z.object({
  pair: z.string().trim(),
  price_precision: z.coerce.number().int(),
  initial_margin: z.coerce.number(),
  minimum_margin: z.coerce.number(),
  maximum_order_size: z.coerce.number(),
  minimum_order_size: z.coerce.number(),
  expiration: z.string(),
  margin: z.coerce.boolean(),
}))
export type OutputV1SymbolsDetails = z.output<typeof ZodOutputV1SymbolsDetails>

// v2AuthReadFundingCredits
export const ZodInputV2AuthReadFundingCredits = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
})
export type InputV2AuthReadFundingCredits = z.input<typeof ZodInputV2AuthReadFundingCredits>
export const ZodOutputV2AuthReadFundingCredits = z.array(z.tuple([
  z.number().int(), // Loan ID
  z.string(), // Symbol: The currency of the loan (fUSD, etc)
  z.number().int(), // Side: 1 if you are the lender, 0 if you are both the lender and borrower, -1 if you're the borrower
  z.number().int(), // MTS_CREATE: Millisecond Time Stamp when the loan was created
  z.number().int(), // MTS_UPDATE: Millisecond Time Stamp when the loan was updated
  z.number(), // AMOUNT: Amount of funds provided
  ZodJsonValue, // FLAGS: Future params object (stay tuned)
  z.string(), // STATUS: Loan Status: ACTIVE
  z.string(), // RATE_TYPE: "FIXED" or "VAR" (for FRR)
  z.unknown(),
  z.unknown(),
  z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
  z.number().int(), // PERIOD: Period of the loan
  z.number().int(), // MTS_OPENING: Millisecond Time Stamp for when the loan was opened
  z.number().int(), // MTS_LAST_PAYOUT: Millisecond Time Stamp for when the last payout was made
  z.coerce.boolean().nullable(), // NOTIFY: 0 if false, 1 if true
  z.coerce.boolean(), // HIDDEN: 0 if false, 1 if true
  z.unknown(),
  z.coerce.boolean(), // RENEW: 0 if false, 1 if true
  z.unknown(),
  z.coerce.boolean(), // NO_CLOSE: If funding will be returned when position is closed. 0 if false, 1 if true
  z.string(), // POSITION_PAIR: Pair of the position that the funding was used for
]).transform(([id, symbol, side, mtsCreate, mtsUpdate, amount, flags, status, rateType,,, rate, period, mtsOpening, mtsLastPayout, notify, hidden,, renew,, noClose, positionPair]) => ({
  id,
  symbol,
  side,
  amount,
  flags,
  status,
  rateType,
  rate,
  period,
  notify,
  hidden,
  renew,
  noClose,
  positionPair,
  mtsOpening: new Date(mtsOpening),
  mtsLastPayout: new Date(mtsLastPayout),
  mtsCreate: new Date(mtsCreate),
  mtsUpdate: new Date(mtsUpdate),
})))
export type OutputV2AuthReadFundingCredits = z.output<typeof ZodOutputV2AuthReadFundingCredits>

// v2AuthReadFundingAutoStatus
export const ZodInputV2AuthReadFundingAutoStatus = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().default('USD'),
})
export type InputV2AuthReadFundingAutoStatus = z.input<typeof ZodInputV2AuthReadFundingAutoStatus>
export const ZodOutputV2AuthReadFundingAutoStatus = z.tuple([
  z.string(), // Currency
  z.number().int(), // PERIOD: Period of the loan
  z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
  z.number(), // AMOUNT: Amount of funds provided
]).transform(([currency, period, rate, amount]) => ({ currency, period, rate, amount })).nullable()
export type OutputV2AuthReadFundingAutoStatus = z.output<typeof ZodOutputV2AuthReadFundingAutoStatus>

// v2AuthReadFundingTradesHist
export const ZodInputV2AuthReadFundingTradesHist = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().optional(),
  start: z.date().transform(transformMts).optional(),
})
export type InputV2AuthReadFundingTradesHist = z.input<typeof ZodInputV2AuthReadFundingTradesHist>
export const ZodOutputV2AuthReadFundingTradesHist = z.array(z.tuple([
  z.number().int(), // Loan ID
  z.string(), // Symbol: The currency of the loan (fUSD, etc)
  z.number().int(), // MTS_CREATE: Millisecond Time Stamp when the loan was created
  z.number().int(), // OFFER_ID: Funding offer ID
  z.number(), // AMOUNT: Amount of funds provided
  z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
  z.number().int(), // PERIOD: Period of the loan
  z.unknown(),
]).transform(([id, symbol, mtsCreate, offerId, amount, rate, period]) => ({
  id,
  symbol,
  offerId,
  amount,
  rate,
  period,
  mtsCreate: new Date(mtsCreate),
})))
export type OutputV2AuthReadFundingTradesHist = z.output<typeof ZodOutputV2AuthReadFundingTradesHist>

// v2AuthReadFundingCreditsHist
export const ZodInputV2AuthReadFundingCreditsHist = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().max(500).default(25),
  start: z.date().transform(transformMts).optional(),
})
export type InputV2AuthReadFundingCreditsHist = z.input<typeof ZodInputV2AuthReadFundingCreditsHist>
export const ZodOutputV2AuthReadFundingCreditsHist = z.array(z.tuple([
  z.number().int(), // Loan ID
  z.string(), // Symbol: The currency of the loan (fUSD, etc)
  z.number().int(), // Side: 1 if you are the lender, 0 if you are both the lender and borrower, -1 if you're the borrower
  z.number().int(), // MTS_CREATE: Millisecond Time Stamp when the loan was created
  z.number().int(), // MTS_UPDATE: Millisecond Time Stamp when the loan was updated
  z.number(), // AMOUNT: Amount of funds provided
  ZodJsonValue, // FLAGS: Future params object (stay tuned)
  z.string(), // STATUS: Loan Status: ACTIVE
  z.string(), // RATE_TYPE: "FIXED" or "VAR" (for FRR)
  z.unknown(),
  z.unknown(),
  z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
  z.number().int(), // PERIOD: Period of the loan
  z.number().int(), // MTS_OPENING: Millisecond Time Stamp for when the loan was opened
  z.number().int(), // MTS_LAST_PAYOUT: Millisecond Time Stamp for when the last payout was made
  z.coerce.boolean().nullable(), // NOTIFY: 0 if false, 1 if true
  z.coerce.boolean(), // HIDDEN: 0 if false, 1 if true
  z.unknown(),
  z.coerce.boolean(), // RENEW: 0 if false, 1 if true
  z.unknown(),
  z.coerce.boolean(), // NO_CLOSE: If funding will be returned when position is closed. 0 if false, 1 if true
  z.string(), // POSITION_PAIR: Pair of the position that the funding was used for
]).transform(([id, symbol, side, mtsCreate, mtsUpdate, amount, flags, status, rateType,,, rate, period, mtsOpening, mtsLastPayout, notify, hidden,, renew,, noClose, positionPair]) => ({
  id,
  symbol,
  side,
  amount,
  flags,
  status,
  rateType,
  rate,
  period,
  notify,
  hidden,
  renew,
  noClose,
  positionPair,
  mtsOpening: new Date(mtsOpening),
  mtsLastPayout: new Date(mtsLastPayout),
  mtsCreate: new Date(mtsCreate),
  mtsUpdate: new Date(mtsUpdate),
})))
export type OutputV2AuthReadFundingCreditsHist = z.output<typeof ZodOutputV2AuthReadFundingCreditsHist>

// v2CandlesFundingHist
const ZodInputV2CandlesBase = z.object({
  section: z.enum(['last', 'hist']).default('hist'),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '3h', '6h', '12h', '1D', '1W', '14D', '1M']).default('1h'),
  limit: z.number().int().max(10000).optional(),
  sort: ZodBitfinexSort.default(enums.BitfinexSort.DESC),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
})
export const ZodInputV2CandlesPair = ZodInputV2CandlesBase.extend({
  pair: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
})
export const ZodInputV2CandlesCurrencyPeriod1 = ZodInputV2CandlesBase.extend({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
  period: z.number().int().default(2).transform(p => `p${p}`),
})
export const ZodInputV2CandlesCurrencyPeriod2 = ZodInputV2CandlesBase.extend({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
  aggregation: z.union([z.literal(10), z.literal(30)]).default(30),
  periodEnd: z.number().int(),
  periodStart: z.number().int(),
}).transform(({ aggregation, periodStart, periodEnd, ...others }) => ({ ...others, period: `a${aggregation}:p${periodStart}:p${periodEnd}` }))
export const ZodInputV2Candles = z.union([
  ZodInputV2CandlesPair,
  ZodInputV2CandlesCurrencyPeriod1,
  ZodInputV2CandlesCurrencyPeriod2,
])
export type InputV2Candles = z.input<typeof ZodInputV2Candles>
export const ZodOutputV2Candles = z.array(z.tuple([
  z.number().int(), // Millisecond epoch timestamp
  z.number(), // Open: First execution during the time frame
  z.number(), // Close: Last execution during the time frame
  z.number(), // HIGH: Highest execution during the time frame
  z.number(), // LOW: Lowest execution during the timeframe
  z.number(), // VOLUME: Quantity of symbol traded within the timeframe
]).transform(([mts, open, close, high, low, volume]) => ({ mts: new Date(mts), open, close, high, low, volume })))
export type OutputV2Candles = z.output<typeof ZodOutputV2Candles>

// v2AuthReadLedgersHist
export const ZodInputV2AuthReadLedgersHist = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
  category: z.nativeEnum(enums.LedgersHistCategory).optional(),
  limit: z.number().int().max(2500).optional(),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
})
export type InputV2AuthReadLedgersHist = z.input<typeof ZodInputV2AuthReadLedgersHist>
export const ZodOutputV2AuthReadLedgersHist = z.array(z.tuple([
  z.number().int(), // ID: Ledger identifier
  z.string().trim(), // CURRENCY: The symbol of the currency (e.g. "BTC")
  z.string().trim().nullable(), // WALLET: Returns the relevant wallet for the ledger entry ('exchange', 'margin', 'funding', 'contribution')
  z.number().int(), // MTS: Timestamp in milliseconds
  z.unknown(),
  z.number(), // AMOUNT: Amount changed
  z.number(), // BALANCE: Balance after change
  z.unknown(),
  z.string().trim(), // DESCRIPTION: Description of ledger transaction
]).transform(([id, currency, wallet, mts,, amount, balance,, description]) => ({
  id,
  currency,
  wallet,
  mts: new Date(mts),
  amount,
  balance,
  description,
})))
export type OutputV2AuthReadLedgersHist = z.output<typeof ZodOutputV2AuthReadLedgersHist>

// v2FundingStatsHist
export const ZodInputV2FundingStatsHist = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().default('USD'),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().max(250).optional(),
})
export type InputV2FundingStatsHist = z.input<typeof ZodInputV2FundingStatsHist>
export const ZodOutputV2FundingStatsHist = z.array(z.tuple([
  z.number().int(), // MTS: Millisecond epoch timestamp
  z.unknown(),
  z.unknown(),
  z.number(), // FRR: 1/365th of Flash Return Rate (To get the daily rate, use: rate x 365. To get the daily rate as percentage use: rate x 365 x 100. To get APR as percentage use rate x 100 x 365 x 365.)
  z.number(), // AVG_PERIOD: Average period for funding provided
  z.unknown(),
  z.unknown(),
  z.number(), // FUNDING_AMOUNT: Total funding provided
  z.number(), // FUNDING_AMOUNT_USED: Total funding provided that is used in positions
  z.unknown(),
  z.unknown(),
  z.number(), // FUNDING_BELOW_THRESHOLD: Sum of open funding offers < 0.75%
]).transform(([mts,,, frrDiv365, avgPeriod,,, amount, amountUsed,,, belowThreshold]) => ({
  mts: new Date(mts),
  frrDiv365,
  frr: _.round(frrDiv365 * 365, 8),
  apr: _.round(frrDiv365 * 133225, 8), // 133225 = 365 * 365
  avgPeriod,
  amount,
  amountUsed,
  belowThreshold,
})))
export type OutputV2FundingStatsHist = z.output<typeof ZodOutputV2FundingStatsHist>

// v2Ticker
export const ZodInputV2TickerPair = z.object({
  pair: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(({ pair }) => `t${pair}`)
export type InputV2TickerPair = z.input<typeof ZodInputV2TickerPair>
export const ZodInputV2TickerCurrency = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(({ currency }) => `f${currency}`)
export type InputV2TickerCurrency = z.input<typeof ZodInputV2TickerCurrency>
export const ZodInputV2TickerSymbol = z.object({
  symbol: z.string().trim().regex(/^[\w:]+$/),
}).transform(({ symbol }) => symbol)
export type InputV2TickerSymbol = z.input<typeof ZodInputV2TickerSymbol>
export const ZodInputV2Ticker = z.union([
  ZodInputV2TickerPair,
  ZodInputV2TickerCurrency,
  ZodInputV2TickerSymbol,
])
export type InputV2Ticker = z.input<typeof ZodInputV2Ticker>
export const ZodOutputV2TickerPair = z.tuple([
  z.string().trim().regex(/^t[\w:]+$/), // SYMBOL: The symbol of the requested ticker data
  z.number(), // BID: Price of last highest bid
  z.number(), // BID_SIZE: Sum of the 25 highest bid sizes
  z.number(), // ASK: Price of last lowest ask
  z.number(), // ASK_SIZE: Sum of the 25 lowest ask sizes
  z.number(), // DAILY_CHANGE: Amount that the last price has changed since yesterday
  z.number(), // DAILY_CHANGE_RELATIVE: Relative price change since yesterday (*100 for percentage change)
  z.number(), // LAST_PRICE: Price of the last trade
  z.number(), // VOLUME: Daily volume
  z.number(), // HIGH: Daily high
  z.number(), // LOW: Daily low
]).transform(([symbol, bidPrice, bidSize, askPrice, askSize, dailyChange, dailyChangeRelative, lastPrice, volume, high, low]) => ({
  symbol,
  pair: symbol.slice(1),
  bidPrice,
  bidSize,
  askPrice,
  askSize,
  dailyChange,
  dailyChangeRelative,
  lastPrice,
  volume,
  high,
  low,
}))
export type OutputV2TickerPair = z.output<typeof ZodOutputV2TickerPair>
const ZodOutputV2TickerCurrency = z.tuple([
  z.string().trim().regex(/^f[\w:]+$/), // SYMBOL: The symbol of the requested ticker data
  z.number(), // FRR: Flash Return Rate - average of all fixed rate funding over the last hour
  z.number(), // BID: Price of last highest bid
  z.number().int(), // BID_PERIOD: Bid period covered in days
  z.number(), // BID_SIZE: Sum of the 25 highest bid sizes
  z.number(), // ASK: Price of last lowest ask
  z.number().int(), // ASK_PERIOD: Ask period covered in days
  z.number(), // ASK_SIZE: Sum of the 25 lowest ask sizes
  z.number(), // DAILY_CHANGE: Amount that the last price has changed since yesterday
  z.number(), // DAILY_CHANGE_PERC: Relative price change since yesterday (*100 for percentage change)
  z.number(), // LAST_PRICE: Price of the last trade
  z.number(), // VOLUME: Daily volume
  z.number(), // HIGH: Daily high
  z.number(), // LOW: Daily low
  z.unknown(),
  z.unknown(),
  z.number(), // FRR_AMOUNT_AVAILABLE: The amount of funding that is available at the Flash Return Rate
]).transform(([symbol, frr, bidPrice, bidPeriod, bidSize, askPrice, askPeriod, askSize, dailyChange, dailyChangePerc, lastPrice, volume, high, low,,, frrAmountAvailable]) => ({
  symbol,
  currency: symbol.slice(1),
  frr,
  dpr: _.round(frr * 100, 8),
  apr: _.round(frr * 365 * 100, 8),
  bidPrice,
  bidPeriod,
  bidSize,
  askPrice,
  askPeriod,
  askSize,
  dailyChange,
  dailyChangePerc,
  lastPrice,
  volume,
  high,
  low,
  frrAmountAvailable,
}))
export type OutputV2TickerCurrency = z.output<typeof ZodOutputV2TickerCurrency>
export const ZodOutputV2Ticker = z.union([
  ZodOutputV2TickerPair,
  ZodOutputV2TickerCurrency,
])
export type OutputV2Ticker = z.output<typeof ZodOutputV2Ticker>

// v2Tickers
export const ZodInputV2Tickers = z.object({
  symbols: z.union([
    z.array(z.string().trim()).min(1).transform(symbols => symbols.join(',')),
    z.string().trim(),
  ]).default('ALL'),
})
export type InputV2Tickers = z.input<typeof ZodInputV2Tickers>
export const ZodOutputV2Tickers = z.array(ZodOutputV2Ticker)
export type OutputV2Tickers = z.output<typeof ZodOutputV2Tickers>

// v2TickersHist
export const ZodInputV2TickersHist = z.object({
  symbols: z.union([
    z.array(z.string().trim()).min(1).transform(symbols => symbols.join(',')),
    z.string().trim(),
  ]).default('ALL'),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().max(250).default(100),
})
export type InputV2TickersHist = z.input<typeof ZodInputV2TickersHist>
export const ZodOutputV2TickersHist = z.array(z.tuple([
  z.string().trim().regex(/^[\w:]+$/), // SYMBOL: The symbol of the requested ticker history data
  z.number(), // BID: Price of last highest bid
  z.unknown(),
  z.number(), // ASK: Price of last lowest ask
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.number().int(), // MTS: Millisecond epoch timestamp
])).transform(tickers => tickers.map(([symbol, bidPrice,, askPrice,,,,,,,,, mts]) => ({
  symbol,
  ...(symbol[0] === 't' ? { pair: symbol.slice(1) } : {}),
  bidPrice,
  askPrice,
  mts: new Date(mts),
})))
export type OutputV2TickersHist = z.output<typeof ZodOutputV2TickersHist>

// v2AuthWriteFundingAuto
const ZodInputV2AuthWriteFundingAutoDeactivate = z.object({
  status: z.literal(enums.FundingAutoStatus.deactivate),
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
})
const ZodInputV2AuthWriteFundingAutoActivate = z.object({
  status: z.literal(enums.FundingAutoStatus.activate),
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
  period: z.number().int().min(2).max(120).optional(),
  amount: z.union([
    z.string().trim(),
    z.number().min(0).transform(utils.formatAmount),
  ]).optional(),
  rate: z.union([
    z.string().trim(),
    z.number().min(0).transform(utils.formatAmount),
  ]).optional(),
})
export const ZodInputV2AuthWriteFundingAuto = z.discriminatedUnion('status', [
  ZodInputV2AuthWriteFundingAutoDeactivate,
  ZodInputV2AuthWriteFundingAutoActivate,
])
export type InputV2AuthWriteFundingAuto = z.input<typeof ZodInputV2AuthWriteFundingAuto>
const ZodOutputV2AuthWriteFundingAutoOffer = z.tuple([
  z.string(), // CURRENCY: Currency (USD, …)
  z.number().int(), // PERIOD: Period in days
  z.number(), // RATE: Rate of the offer (percentage expressed as decimal number i.e. 1% = 0.01)
  z.number(), // THRESHOLD: Max amount to be auto-renewed
]).transform(([currency, period, rate, threshold]) => ({ currency, period, rate, threshold }))
export const ZodOutputV2AuthWriteFundingAuto = z.tuple([
  z.number().int(), // MTS: Seconds epoch timestamp of notification
  z.string(), // TYPE: Notification's type ("fa-req")
  z.number().int().nullable(), // MESSAGE_ID: Unique notification's ID
  z.unknown(),
  ZodOutputV2AuthWriteFundingAutoOffer.nullable(), // FUNDING_OFFER_ARRAY: An array containing data for the funding offer
  z.number().int().nullable(), // CODE: W.I.P. (work in progress)
  z.string(), // STATUS: Status of the notification; it may vary over time (SUCCESS, ERROR, FAILURE, ...)
  z.string(), // TEXT: Additional notification description
]).transform(([mts, type, msgId,, offer, code, status, text]) => ({
  mts: new Date(mts),
  type,
  msgId,
  offer,
  code,
  status,
  text,
}))
export type OutputV2AuthWriteFundingAuto = z.output<typeof ZodOutputV2AuthWriteFundingAuto>

// v2AuthWriteFundingOfferCancelAll
export const ZodInputV2AuthWriteFundingOfferCancelAll = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
})
export type InputV2AuthWriteFundingOfferCancelAll = z.input<typeof ZodInputV2AuthWriteFundingOfferCancelAll>
export const ZodOutputV2AuthWriteFundingOfferCancelAll = z.tuple([
  z.number().int(), // MTS: Millisecond Time Stamp of the update
  z.string(), // TYPE: Purpose of notification ('foc_all-req' (funding offer cancel all request))
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.string(), // STATUS: Status of the notification; it may vary over time (SUCCESS, ERROR, FAILURE, ...)
  z.string(), // TEXT: Text of the notification
]).transform(([mts, type,,,,, status, text]) => ({
  mts: new Date(mts),
  type,
  status,
  text,
}))
export type OutputV2AuthWriteFundingOfferCancelAll = z.output<typeof ZodOutputV2AuthWriteFundingOfferCancelAll>

// v2AuthReadInfoFunding
export const ZodInputV2AuthReadInfoFunding = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().default('USD'),
})
export type InputV2AuthReadInfoFunding = z.input<typeof ZodInputV2AuthReadInfoFunding>
const ZodOutputV2AuthReadInfoFundingInfo = z.tuple([
  z.number(), // YIELD_LOAN: Weighted average rate for taken funding
  z.number(), // YIELD_LEND: Weighted average rate for provided funding
  z.number(), // DURATION_LOAN: Weighted average duration for taken funding
  z.number(), // DURATION_LEND: Weighted average duration for provided funding
]).transform(([yieldLoan, yieldLend, durationLoan, durationLend]) => ({ yieldLoan, yieldLend, durationLoan, durationLend }))
export const ZodOutputV2AuthReadInfoFunding = z.tuple([
  z.string(), // "sym"
  z.string(), // SYMBOL: The symbol the information pertains to (funding currencies)
  ZodOutputV2AuthReadInfoFundingInfo, // FUNDING_INFO_ARRAY: Contains info on the yield and duration of the user's taken and provided funding
]).transform(([, symbol, info]) => ({
  symbol,
  currency: symbol.slice(1),
  ...info,
}))
export type OutputV2AuthReadInfoFunding = z.output<typeof ZodOutputV2AuthReadInfoFunding>

// v2IntGeoIp
const ZodOutputV2IntGeoIpGeo = z.object({
  range: z.tuple([z.number(), z.number()]),
  country: z.string(),
  region: z.string(),
  eu: z.string().transform(eu => eu === '1'),
  timezone: z.string(),
  city: z.string(),
  ll: z.tuple([z.number(), z.number()]),
  metro: z.number(),
  area: z.number(),
})
export const ZodOutputV2IntGeoIp = z.tuple([
  z.string(), // IP
  ZodOutputV2IntGeoIpGeo,
]).transform(([ip, geoip]) => ({ ip, ...geoip }))
export type OutputV2IntGeoIp = z.output<typeof ZodOutputV2IntGeoIp>

// v2AuthReadInfoUser ZodOutputV2AuthReadInfoUser
export const ZodOutputV2AuthReadInfoUser = z.tuple([
  z.number().int(), // ID: Account ID
  z.string(), // EMAIL: Account Email
  z.string(), // USERNAME: Account Username
  z.number().int(), // MTS_ACCOUNT_CREATE: Millisecond timestamp of account creation
  z.coerce.boolean(), // VERIFIED: Indicates if the user has a verified status (KYC) 1 = true, 0 = false
  z.number().int(), // VERIFICATION_LEVEL: Account verification level
  z.unknown(),
  z.string(), // TIMEZONE: Account timezone setting
  z.string().nullable(), // LOCALE: Account locale setting
  z.string(), // COMPANY: Shows where the account is registered. Accounts registered at Bitfinex will show 'bitfinex' and accounts registered at eosfinex will show 'eosfinex'
  z.coerce.boolean(), // EMAIL_VERIFIED: 1 if true
  z.unknown(),
  z.unknown(), // SUBACCOUNT_TYPE: TBD
  z.unknown(),
  z.number().int().nullable(), // MTS_MASTER_ACCOUNT_CREATE: Millisecond timestamp of master account creation
  z.number().int().nullable(), // GROUP_ID: Account group ID
  z.number().int().nullable(), // MASTER_ACCOUNT_ID: The ID of the master account, If the account is a sub-account.
  z.coerce.boolean(), // INHERIT_MASTER_ACCOUNT_VERIFICATION: 1 if account inherits verification from master account
  z.coerce.boolean(), // IS_GROUP_MASTER: 1 if account is a master account
  z.coerce.boolean(), // GROUP_WITHDRAW_ENABLED: 1 if enabled
  z.unknown(),
  z.coerce.boolean(), // PPT_ENABLED: 1 if true (for paper trading accounts)
  z.coerce.boolean(), // MERCHANT_ENABLED: 1 if true (for merchant accounts)
  z.coerce.boolean(), // COMPETITION_ENABLED: 1 if true (for competition accounts)
  z.unknown(),
  z.unknown(),
  z.array(z.string()), // 2FA_MODES: Array of enabled 2FA modes ('u2f', 'otp')
  z.unknown(),
  z.coerce.boolean(), // IS_SECURITIES_MASTER: 1 if true (when the account has a securities sub-account)
  z.coerce.boolean(), // SECURITIES_ENABLED: 1 if true (for securities accounts)
  z.coerce.boolean(), // IS_SECURITIES_INVESTOR_ACCREDITED: 1 if true (when an account is accredited investor verified)
  z.coerce.boolean(), // IS_SECURITIES_EL_SALVADOR: 1 if true (if an account is verified for El Salvador securities)
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.coerce.boolean(), // ALLOW_DISABLE_CTXSWITCH: Account can disable context switching by master account into this account (1 if true)
  z.coerce.boolean(), // CTXSWITCH_DISABLED: Master account cannot context switch into this account (1 if true)
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.unknown(),
  z.coerce.date().nullable(), // TIME_LAST_LOGIN: Date and time of last login
  z.unknown(),
  z.unknown(),
  z.number().int(), // VERIFICATION_LEVEL_SUBMITTED: Level of highest verification application submitted from the account
  z.unknown(),
  z.array(z.string()), // COMP_COUNTRIES: Array of country codes based on your verification data (residence and nationality)
  z.array(z.string()), // COMP_COUNTRIES_RESID: Array of country codes based on your verification data (residence only)
  z.string(), // COMPL_ACCOUNT_TYPE: Type of compliance verification ("individual" or "corporate")
  z.unknown(),
  z.unknown(),
  z.coerce.boolean(), // IS_MERCHANT_ENTERPRISE: 1 if true (when account is enterprise merchant)
]).transform(([id, email, username, mtsAccountCreate, verified, verificationLevel,, timezone, locale, company, emailVerified,,,, mtsMasterAccountCreate, groupId, masterAccountId, inheritMasterAccountVerification, isGroupMaster, groupWithdrawEnabled,, pptEnabled, merchantEnabled, competitionEnabled,,, modes2FA,, isSecuritiesMaster, securitiesEnabled, isSecuritiesInvestorAccredited, isSecuritiesElSalvador,,,,,,, allowDisableCtxSwitch, ctxSwitchDisabled,,,,, timeLastLogin,,, verificationLevelSubmitted,, compCountries, compCountriesResid, complAccountType,,, isMerchantEnterprise]) => ({
  company,
  compCountries,
  compCountriesResid,
  competitionEnabled,
  complAccountType,
  email,
  id,
  locale,
  modes2FA,
  mtsAccountCreate: new Date(mtsAccountCreate),
  pptEnabled,
  timeLastLogin,
  timezone,
  username,
  ctxSwitch: {
    allowDisable: allowDisableCtxSwitch,
    disabled: ctxSwitchDisabled,
  },
  masterAccount: {
    groupId,
    groupWithdrawEnabled,
    id: masterAccountId,
    inheritVerification: inheritMasterAccountVerification,
    isGroupMaster,
    mtsCreate: mtsMasterAccountCreate ? new Date(mtsMasterAccountCreate) : null,
  },
  merchant: {
    enabled: merchantEnabled,
    isEnterprise: isMerchantEnterprise,
  },
  securities: {
    enabled: securitiesEnabled,
    isElSalvador: isSecuritiesElSalvador,
    isInvestorAccredited: isSecuritiesInvestorAccredited,
    isMaster: isSecuritiesMaster,
  },
  verification: {
    email: emailVerified,
    level: verificationLevel,
    levelSubmitted: verificationLevelSubmitted,
    verified,
  },
}))
export type OutputV2AuthReadInfoUser = z.output<typeof ZodOutputV2AuthReadInfoUser>
