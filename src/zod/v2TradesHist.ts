import _ from 'lodash'
import { z } from 'zod'
import * as enums from '../enums'
import * as zod from './index'

const ZodInputBase = z.object({
  end: z.date().transform(zod.transformMts).optional(),
  limit: z.number().int().max(10000).default(125),
  sort: zod.ZodBitfinexSort.default(enums.BitfinexSort.DESC),
  start: z.date().transform(zod.transformMts).optional(),
})

const ZodInputPair = ZodInputBase.extend({
  pair: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(obj => ({ ...obj, symbol: `t${obj.pair}` }))
export type InputPair = z.input<typeof ZodInputPair>

const ZodInputCurrency = ZodInputBase.extend({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
}).transform(obj => ({ ...obj, symbol: `f${obj.currency}` }))
export type InputCurrency = z.input<typeof ZodInputCurrency>

const ZodInputSymbol = ZodInputBase.extend({
  symbol: z.string().trim().regex(/^[\w:]+$/),
})
export type InputSymbol = z.input<typeof ZodInputSymbol>

export const ZodInput = z.union([
  ZodInputPair,
  ZodInputCurrency,
  ZodInputSymbol,
])
export type Input = z.input<typeof ZodInput>

const ZodOutputPair = z.object({
  amount: z.number(),
  id: z.number().int(),
  mts: z.coerce.date(),
  price: z.number(),
})
const ZodOutputPairs = z.array(ZodOutputPair)
export type OutputPairs = z.output<typeof ZodOutputPairs>

const ZodOutputCurrency = z.object({
  amount: z.number(),
  id: z.number().int(),
  mts: z.coerce.date(),
  period: z.number().int(),
  rate: z.number(),
})
const ZodOutputCurrencys = z.array(ZodOutputCurrency)
export type OutputCurrencys = z.output<typeof ZodOutputCurrencys>

const ZodOutput = z.union([
  ZodOutputPairs,
  ZodOutputCurrencys,
])
export type Output = z.output<typeof ZodOutput>

const PAIR_INDEX: Record<string, number> = {
  id: 0,
  mts: 1,
  amount: 2,
  price: 3,
}

const CURRENCY_INDEX: Record<string, number> = {
  id: 0,
  mts: 1,
  amount: 2,
  rate: 3,
  period: 4,
}

export function parseOutput (output: any[]): Output {
  try {
    if (output.length === 0) return []
    else if (output[0].length === 4) {
      return _.map(output, hist => ZodOutputPair.parse(_.mapValues(PAIR_INDEX, idx => hist?.[idx] ?? null)))
    } else if (output[0].length === 5) {
      return _.map(output, hist => ZodOutputCurrency.parse(_.mapValues(CURRENCY_INDEX, idx => hist?.[idx] ?? null)))
    }
    throw new Error('unable to parse output')
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
