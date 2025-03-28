import _ from 'lodash'
import { z } from 'zod'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
})
export type Input = z.input<typeof ZodInput>

const ZodOutput = z.object({
  mts: z.coerce.date(), // MTS: Millisecond Time Stamp of the update
  type: z.string(), // TYPE: Purpose of notification ('foc_all-req' (funding offer cancel all request))
  status: z.string(), // STATUS: Status of the notification; it may vary over time (SUCCESS, ERROR, FAILURE, ...)
  text: z.string(), // TEXT: Text of the notification
})
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  mts: 0,
  type: 1,
  status: 6,
  text: 7,
}

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse(_.mapValues(OUTPUT_INDEX, idx => output?.[idx] ?? null))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
