import _ from 'lodash'
import { z } from 'zod'
import { transformMts } from './index'

export const ZodInput = z.object({
  symbols: z.union([
    z.array(z.string().trim()).min(1).transform(symbols => symbols.join(',')),
    z.string().trim(),
  ]).default('ALL'),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().max(250).default(100),
})
export type Input = z.input<typeof ZodInput>

const ZodOutputTickerHist = z.object({
  symbol: z.string().trim().regex(/^[\w:]+$/), // SYMBOL: The symbol of the requested ticker history data
  bidPrice: z.number(), // BID: Price of last highest bid
  askPrice: z.number(), // ASK: Price of last lowest ask
  mts: z.coerce.date(), // MTS: Millisecond epoch timestamp
}).transform(obj => ({
  ...obj,
  ...(obj.symbol[0] === 't' ? { pair: obj.symbol.slice(1) } : {}),
}))

const ZodOutput = z.array(ZodOutputTickerHist)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  symbol: 0,
  bidPrice: 1,
  askPrice: 3,
  mts: 12,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, hist => ZodOutputTickerHist.parse(_.mapValues(OUTPUT_INDEX, idx => hist[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
