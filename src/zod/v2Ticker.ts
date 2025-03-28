import _ from 'lodash'
import { z } from 'zod'

const ZodInputPair = z.object({
  pair: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(({ pair }) => `t${pair}`)
export type InputPair = z.input<typeof ZodInputPair>

export const ZodInputCurrency = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(({ currency }) => `f${currency}`)
export type InputCurrency = z.input<typeof ZodInputCurrency>

export const ZodInputSymbol = z.object({
  symbol: z.string().trim().regex(/^[\w:]+$/),
}).transform(({ symbol }) => symbol)
export type InputSymbol = z.input<typeof ZodInputSymbol>

export const ZodInput = z.union([
  ZodInputPair,
  ZodInputCurrency,
  ZodInputSymbol,
])
export type Input = z.input<typeof ZodInput>

const ZodOutputPair = z.object({
  symbol: z.string().trim().regex(/^t[\w:]+$/), // SYMBOL: The symbol of the requested ticker data
  bidPrice: z.number(), // BID: Price of last highest bid
  bidSize: z.number(), // BID_SIZE: Sum of the 25 highest bid sizes
  askPrice: z.number(), // ASK: Price of last lowest ask
  askSize: z.number(), // ASK_SIZE: Sum of the 25 lowest ask sizes
  dailyChange: z.number(), // DAILY_CHANGE: Amount that the last price has changed since yesterday
  dailyChangeRelative: z.number(), // DAILY_CHANGE_RELATIVE: Relative price change since yesterday (*100 for percentage change)
  lastPrice: z.number(), // LAST_PRICE: Price of the last trade
  volume: z.number(), // VOLUME: Daily volume
  high: z.number(), // HIGH: Daily high
  low: z.number(), // LOW: Daily low
}).transform(obj => ({
  ...obj,
  pair: obj.symbol.slice(1),
}))
export type OutputPair = z.output<typeof ZodOutputPair>

const ZodOutputCurrency = z.object({
  symbol: z.string().trim().regex(/^f[\w:]+$/), // SYMBOL: The symbol of the requested ticker data
  frr: z.number(), // FRR: Flash Return Rate - average of all fixed rate funding over the last hour
  bidPrice: z.number(), // BID: Price of last highest bid
  bidPeriod: z.number().int(), // BID_PERIOD: Bid period covered in days
  bidSize: z.number(), // BID_SIZE: Sum of the 25 highest bid sizes
  askPrice: z.number(), // ASK: Price of last lowest ask
  askPeriod: z.number().int(), // ASK_PERIOD: Ask period covered in days
  askSize: z.number(), // ASK_SIZE: Sum of the 25 lowest ask sizes
  dailyChange: z.number(), // DAILY_CHANGE: Amount that the last price has changed since yesterday
  dailyChangePerc: z.number(), // DAILY_CHANGE_PERC: Relative price change since yesterday (*100 for percentage change)
  lastPrice: z.number(), // LAST_PRICE: Price of the last trade
  volume: z.number(), // VOLUME: Daily volume
  high: z.number(), // HIGH: Daily high
  low: z.number(), // LOW: Daily low
  frrAmountAvailable: z.number(), // FRR_AMOUNT_AVAILABLE: The amount of funding that is available at the Flash Return Rate
}).transform(obj => ({
  ...obj,
  currency: obj.symbol.slice(1),
  dpr: _.round(obj.frr * 100, 8),
  apr: _.round(obj.frr * 365 * 100, 8),
}))
export type OutputCurrency = z.output<typeof ZodOutputCurrency>

export const ZodOutput = z.union([
  ZodOutputPair,
  ZodOutputCurrency,
])
export type Output = z.output<typeof ZodOutput>

const PAIR_INDEX: Record<string, number> = {
  symbol: 0,
  bidPrice: 1,
  bidSize: 2,
  askPrice: 3,
  askSize: 4,
  dailyChange: 5,
  dailyChangeRelative: 6,
  lastPrice: 7,
  volume: 8,
  high: 9,
  low: 10,
}

const CURRENCY_INDEX: Record<string, number> = {
  symbol: 0,
  frr: 1,
  bidPrice: 2,
  bidPeriod: 3,
  bidSize: 4,
  askPrice: 5,
  askPeriod: 6,
  askSize: 7,
  dailyChange: 8,
  dailyChangePerc: 9,
  lastPrice: 10,
  volume: 11,
  high: 12,
  low: 13,
  frrAmountAvailable: 16,
}

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse({
      ...(output.length === 11 ? _.mapValues(PAIR_INDEX, idx => output?.[idx] ?? null) : {}),
      ...(output.length === 17 ? _.mapValues(CURRENCY_INDEX, idx => output?.[idx] ?? null) : {}),
    })
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
