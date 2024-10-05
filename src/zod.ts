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
  limit: z.number().max(10000).default(125),
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
  currency: z.string().toUpperCase().default('USD'),
  limit: z.number().max(10000).default(125),
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
