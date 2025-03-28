import _ from 'lodash'
import { z } from 'zod'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().default('USD'),
})
export type Input = z.input<typeof ZodInput>

const INFO_INDEX: Record<string, number> = {
  yieldLoan: 0,
  yieldLend: 1,
  durationLoan: 2,
  durationLend: 3,
}

const ZodOutput = z.object({
  symbol: z.string(), // SYMBOL: The symbol the information pertains to (funding currencies)
  yieldLoan: z.number(), // YIELD_LOAN: Weighted average rate for taken funding
  yieldLend: z.number(), // YIELD_LEND: Weighted average rate for provided funding
  durationLoan: z.number(), // DURATION_LOAN: Weighted average duration for taken funding
  durationLend: z.number(), // DURATION_LEND: Weighted average duration for provided funding
}).transform(obj => ({ ...obj, currency: obj.symbol.slice(1) }))
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  symbol: 1,
  // fundingInfo: 2,
}

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse({
      ..._.mapValues(OUTPUT_INDEX, idx => output[idx] ?? null),
      ..._.mapValues(INFO_INDEX, idx => output[2]?.[idx] ?? null),
    })
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
