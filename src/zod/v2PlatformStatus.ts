import _ from 'lodash'
import { z } from 'zod'
import * as enums from '../enums'

const ZodOutput = z.object({
  status: z.nativeEnum(enums.PlatformStatus), // 1: operative, 0: maintenance
})
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  status: 0,
}

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse(_.mapValues(OUTPUT_INDEX, idx => output?.[idx] ?? null))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
