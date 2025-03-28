import _ from 'lodash'
import { z } from 'zod'

const ZodOutput = z.record(z.string(), z.object({
  read: z.coerce.boolean(),
  write: z.coerce.boolean(),
}))
export type Output = z.output<typeof ZodOutput>

export function parseOutput (output: any[]): Output {
  try {
    const perms: Record<string, { read: boolean, write: boolean }> = {}
    for (const [scope, read, write] of output) perms[scope] = { read, write }
    return ZodOutput.parse(perms)
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
