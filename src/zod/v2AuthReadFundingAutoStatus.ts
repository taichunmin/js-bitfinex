import _ from 'lodash'
import { z } from 'zod'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
})
export type Input = z.input<typeof ZodInput>

const ZodOutput = z.object({
  amount: z.number(), // AMOUNT: Amount of funds provided
  currency: z.string(),
  period: z.number().int(), // PERIOD: Period of the loan
  rate: z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
}).nullable()
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  currency: 0,
  period: 1,
  rate: 2,
  amount: 3,
}

export function parseOutput (output: any[] | null): Output {
  try {
    if (_.isNil(output)) return null
    return ZodOutput.parse(_.mapValues(OUTPUT_INDEX, idx => output?.[idx] ?? null))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
