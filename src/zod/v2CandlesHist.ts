import _ from 'lodash'
import { z } from 'zod'
import * as enums from '../enums'
import { transformMts, ZodBitfinexSort } from './index'

const ZodInputBase = z.object({
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '3h', '6h', '12h', '1D', '1W', '14D', '1M']).default('1h'),
  limit: z.number().int().max(10000).optional(),
  sort: ZodBitfinexSort.default(enums.BitfinexSort.DESC),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
})

const ZodInputPair = ZodInputBase.extend({
  pair: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
})
export type InputPair = z.input<typeof ZodInputPair>

const ZodInputCurrencyPeriod1 = ZodInputBase.extend({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
  period: z.number().int().transform(p => `p${p}`),
})
export type InputCurrencyPeriod1 = z.input<typeof ZodInputCurrencyPeriod1>

const ZodInputCurrencyPeriod2 = ZodInputBase.extend({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
  aggregation: z.union([z.literal(10), z.literal(30)]).default(30),
  periodEnd: z.number().int(),
  periodStart: z.number().int(),
}).transform(({ aggregation, periodStart, periodEnd, ...others }) => ({ ...others, period: `a${aggregation}:p${periodStart}:p${periodEnd}` }))
export type InputCurrencyPeriod2 = z.input<typeof ZodInputCurrencyPeriod2>

export const ZodInput = z.union([
  ZodInputPair,
  ZodInputCurrencyPeriod1,
  ZodInputCurrencyPeriod2,
])
export type Input = z.input<typeof ZodInput>

const ZodOutputCandle = z.object({
  mts: z.coerce.date(), // Millisecond epoch timestamp
  open: z.number(), // Open: First execution during the time frame
  close: z.number(), // Close: Last execution during the time frame
  high: z.number(), // HIGH: Highest execution during the time frame
  low: z.number(), // LOW: Lowest execution during the timeframe
  volume: z.number(), // VOLUME: Quantity of symbol traded within the timeframe
})

const ZodOutput = z.array(ZodOutputCandle)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  mts: 0,
  open: 1,
  close: 2,
  high: 3,
  low: 4,
  volume: 5,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, candle => ZodOutputCandle.parse(_.mapValues(OUTPUT_INDEX, idx => candle[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
