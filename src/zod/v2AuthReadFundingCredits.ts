import _ from 'lodash'
import { z } from 'zod'
import { ZodJsonValue } from './index'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
})
export type Input = z.input<typeof ZodInput>

const ZodOutputCredit = z.object({
  amount: z.number(),
  flags: ZodJsonValue,
  hidden: z.coerce.boolean(),
  id: z.number().int(),
  mtsCreate: z.coerce.date(),
  mtsLastPayout: z.coerce.date(),
  mtsOpening: z.coerce.date(),
  mtsUpdate: z.coerce.date(),
  noClose: z.coerce.boolean(),
  notify: z.coerce.boolean(),
  period: z.number().int(),
  positionPair: z.string(),
  rate: z.number(),
  rateType: z.string(),
  renew: z.coerce.boolean(),
  side: z.number().int(),
  status: z.string(),
  symbol: z.string(),
}).transform(obj => ({ ...obj, currency: obj.symbol.slice(1) }))

const ZodOutput = z.array(ZodOutputCredit)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  id: 0,
  symbol: 1,
  side: 2,
  mtsCreate: 3,
  mtsUpdate: 4,
  amount: 5,
  flags: 6,
  status: 7,
  rateType: 8,
  rate: 11,
  period: 12,
  mtsOpening: 13,
  mtsLastPayout: 14,
  notify: 15,
  hidden: 16,
  renew: 18,
  noClose: 20,
  positionPair: 21,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, credit => ZodOutputCredit.parse(_.mapValues(OUTPUT_INDEX, idx => credit[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
