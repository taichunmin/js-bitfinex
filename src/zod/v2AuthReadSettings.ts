import _ from 'lodash'
import { z } from 'zod'

export const ZodInput = z.array(z.string().regex(/^api:[A-Za-z0-9*_-]*$/)).min(1)
export type Input = z.input<typeof ZodInput>

const ZodOutput = z.record(z.string().regex(/^[A-Za-z0-9_-]*$/), z.json())
export type Output = z.output<typeof ZodOutput>

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse(_.fromPairs(output))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
