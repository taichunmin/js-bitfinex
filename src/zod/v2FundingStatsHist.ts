import _ from 'lodash'
import { z } from 'zod'
import { transformMts } from './index'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().default('USD'),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().max(250).optional(),
})
export type Input = z.input<typeof ZodInput>

const ZodOutputFundingStats = z.object({
  mts: z.coerce.date(), // MTS: Millisecond epoch timestamp
  frrDiv365: z.number(), // FRR: 1/365th of Flash Return Rate (To get the daily rate, use: rate x 365. To get the daily rate as percentage use: rate x 365 x 100. To get APR as percentage use rate x 100 x 365 x 365.)
  avgPeriod: z.number(), // AVG_PERIOD: Average period for funding provided
  amount: z.number(), // FUNDING_AMOUNT: Total funding provided
  amountUsed: z.number(), // FUNDING_AMOUNT_USED: Total funding provided that is used in positions
  belowThreshold: z.number(), // FUNDING_BELOW_THRESHOLD: Sum of open funding offers < 0.75%
}).transform(obj => ({
  ...obj,
  frr: _.round(obj.frrDiv365 * 365, 8),
  apr: _.round(obj.frrDiv365 * 133225, 8), // 133225 = 365 * 365
}))
const ZodOutput = z.array(ZodOutputFundingStats)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  mts: 0,
  frrDiv365: 3,
  avgPeriod: 4,
  amount: 7,
  amountUsed: 8,
  belowThreshold: 11,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, stats => ZodOutputFundingStats.parse(_.mapValues(OUTPUT_INDEX, idx => stats[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
