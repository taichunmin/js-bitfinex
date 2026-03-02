import _ from 'lodash'
import { z } from 'zod'

export const ZodInput = z.array(z.string().regex(/^api:[A-Za-z0-9*_-]*$/)).min(1)
export type Input = z.input<typeof ZodInput>

const ZodOutput = z.object({
  mts: z.coerce.date(), // TIMESTAMP: Timestamp in milliseconds
  type: z.string(), // TYPE: Purpose of notification ('acc_ss' (account settings set))
  status: z.string(), // STATUS: Status of the notification; it may vary over time (SUCCESS, ERROR, FAILURE, ...)
})
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  mts: 0,
  type: 1,
  status: 6,
}

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse({
      ..._.mapValues(OUTPUT_INDEX, idx => output[idx] ?? null),
    })
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
