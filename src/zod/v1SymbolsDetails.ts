import _ from 'lodash'
import { z } from 'zod'

export const ZodOutput = z.array(z.object({
  expiration: z.string(),
  initial_margin: z.coerce.number(),
  margin: z.coerce.boolean(),
  maximum_order_size: z.coerce.number(),
  minimum_margin: z.coerce.number(),
  minimum_order_size: z.coerce.number(),
  pair: z.string().trim(),
  price_precision: z.coerce.number().int(),
}))
export type Output = z.output<typeof ZodOutput>

export function parseOutput (output: any): Output {
  try {
    return ZodOutput.parse(output)
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
