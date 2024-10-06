import _ from 'lodash'
import { z } from 'zod'
import * as enums from './enums'

export * from 'zod'

// JSON type: https://zod.dev/?id=json-type
export const ZodJsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()])
export type JsonPrimitive = z.output<typeof ZodJsonPrimitive>
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[]
export const ZodJsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  ZodJsonPrimitive,
  z.array(ZodJsonValue),
  z.record(ZodJsonValue),
]))
export const ZodJsonObject = z.record(ZodJsonValue)
export type JsonObject = z.output<typeof ZodJsonObject>
export const ZodJsonArray = z.array(ZodJsonValue)
export type JsonArray = z.output<typeof ZodJsonArray>

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

// v2TradesTradingHist
export const ZodInputV2TradesTradingHist = z.object({
  pair: z.string().toUpperCase().default('BTCUSD'),
  limit: z.number().int().max(10000).default(125),
  sort: ZodBitfinexSort.default(enums.BitfinexSort.DESC),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
})
export type InputV2TradesTradingHist = z.input<typeof ZodInputV2TradesTradingHist>

export const ZodOutputV2TradesTradingHist = z.array(z.tuple([
  z.number().int(), // ID of the trade
  z.number().int(), // Millisecond epoch timestamp
  z.number(), // How much was bought (positive) or sold (negative)
  z.number(), // Price at which the trade was executed
]).transform(([id, mts, amount, price]) => ({ id, mts: new Date(mts), amount, price })))
export type OutputV2TradesTradingHist = z.output<typeof ZodOutputV2TradesTradingHist>

// v2TradesFundingHist
export const ZodInputV2TradesFundingHist = z.object({
  currency: z.string().trim().toUpperCase().default('USD'),
  limit: z.number().int().max(10000).default(125),
  sort: ZodBitfinexSort.default(enums.BitfinexSort.DESC),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
})
export type InputV2TradesFundingHist = z.input<typeof ZodInputV2TradesFundingHist>

export const ZodOutputV2TradesFundingHist = z.array(z.tuple([
  z.number().int(), // ID of the trade
  z.number().int(), // Millisecond epoch timestamp
  z.number(), // How much was bought (positive) or sold (negative)
  z.number(), // Rate at which funding transaction occurred
  z.number().int(), // Amount of time the funding transaction was for
]).transform(([id, mts, amount, rate, period]) => ({ id, mts: new Date(mts), amount, rate, period })))
export type OutputV2TradesFundingHist = z.output<typeof ZodOutputV2TradesFundingHist>

// v2AuthReadPermissions
export type OutputV2AuthReadPermissions = { [P in string]?: { read: 0 | 1, write: 0 | 1 } }
export const ZodOutputV2AuthReadPermissions = z.array(z.tuple([
  z.string(), // Api scope
  z.union([z.literal(0), z.literal(1)]), // Read permission: false = 0, true = 1
  z.union([z.literal(0), z.literal(1)]), // Write permission: false = 0, true = 1
])).transform(perms => {
  const transformed: OutputV2AuthReadPermissions = {}
  for (const perm of perms) transformed[perm[0]] = { read: perm[1], write: perm[2] }
  return transformed
})

// v2AuthReadWallets
export type OutputV2AuthReadWallets = Array<{
  type: string
  currency: string
  balance: number
  unsettledInterest: number
  availableBalance: number
  lastChange?: Record<string, JsonValue> & { desc?: string }
}>
export const ZodOutputV2AuthReadWallets = z.array(z.tuple([
  z.string(), // Wallet name (exchange, margin, funding)
  z.string(), // Currency (e.g. USD, BTC, ETH, ...)
  z.number(), // Balance
  z.number(), // Unsettled interest
  z.number(), // Wallet balance available for orders/withdrawal/transfer
  z.string().nullable(), // Description of the last ledger entry
  ZodJsonObject.nullable(), // Optional object with details of LAST_CHANGE
]).transform(([type, currency, balance, unsettledInterest, availableBalance, lastChangeDesc, lastChange]) => ({
  type,
  currency,
  balance,
  unsettledInterest,
  availableBalance,
  ...(_.isNil(lastChangeDesc) && _.isNil(lastChange) ? {} : {
    lastChange: ({
      ...(_.isNil(lastChangeDesc) ? {} : { desc: lastChangeDesc }),
      ...(_.isNil(lastChange) ? {} : lastChange),
    } as unknown as Record<string, JsonValue> & { desc?: string }),
  }),
})))

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
  currency: z.string().trim().toUpperCase().optional(),
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
  currency: z.string().trim().toUpperCase().default('USD'),
})
export type InputV2AuthReadFundingAutoStatus = z.input<typeof ZodInputV2AuthReadFundingAutoStatus>
export const ZodOutputV2AuthReadFundingAutoStatus = z.tuple([
  z.string(), // Currency
  z.number().int(), // PERIOD: Period of the loan
  z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
  z.number(), // AMOUNT: Amount of funds provided
]).transform(([currency, period, rate, amount]) => ({ currency, period, rate, amount }))
export type OutputV2AuthReadFundingAutoStatus = z.output<typeof ZodOutputV2AuthReadFundingAutoStatus>

// v2AuthReadFundingTradesHist
export const ZodInputV2AuthReadFundingTradesHist = z.object({
  currency: z.string().trim().toUpperCase().optional(),
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
  currency: z.string().trim().toUpperCase().optional(),
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
export const ZodInputV2Candles = z.union([
  ZodInputV2CandlesBase.extend({
    currency: z.undefined(),
    period: z.undefined(),
    pair: z.string().trim().toUpperCase().default('BTCUSD'),
  }),
  ZodInputV2CandlesBase.extend({
    pair: z.undefined(),
    currency: z.string().trim().toUpperCase().default('USD'),
    period: z.number().int().default(2).transform(p => `p${p}`),
  }),
  ZodInputV2CandlesBase.extend({
    pair: z.undefined(),
    currency: z.string().trim().toUpperCase().default('USD'),
    aggregation: z.union([z.literal(10), z.literal(30)]).default(30),
    periodEnd: z.number().int(),
    periodStart: z.number().int(),
  }).transform(({ aggregation, periodStart, periodEnd, ...others }) => ({ ...others, period: `a${aggregation}:p${periodStart}:p${periodEnd}` })),
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
  currency: z.string().trim().toUpperCase().optional(),
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
