import _ from 'lodash'
import { z } from 'zod'
import { transformMts } from './index'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().optional(),
  start: z.date().transform(transformMts).optional(),
})
export type Input = z.input<typeof ZodInput>

export const ZodOutputTrade = z.object({
  amount: z.number(), // AMOUNT: Amount of funds provided
  id: z.number().int(), // Loan ID
  mtsCreate: z.coerce.date(), // MTS_CREATE: Millisecond Time Stamp when the loan was created
  offerId: z.number().int(), // OFFER_ID: Funding offer ID
  period: z.number().int(), // PERIOD: Period of the loan
  rate: z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
  symbol: z.string(), // Symbol: The currency of the loan (fUSD, etc)
}).transform(obj => ({ ...obj, currency: obj.symbol.slice(1) }))
export const ZodOutput = z.array(ZodOutputTrade)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  id: 0,
  symbol: 1,
  mtsCreate: 2,
  offerId: 3,
  amount: 4,
  rate: 5,
  period: 6,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, trade => ZodOutputTrade.parse(_.mapValues(OUTPUT_INDEX, idx => trade[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
