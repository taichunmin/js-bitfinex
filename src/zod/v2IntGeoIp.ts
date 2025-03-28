import _ from 'lodash'
import { z } from 'zod'

export const ZodOutput = z.object({
  area: z.number(),
  city: z.string(),
  country: z.string(),
  eu: z.string().transform(eu => eu === '1'),
  ip: z.string(),
  ll: z.tuple([z.number(), z.number()]),
  metro: z.number(),
  range: z.tuple([z.number(), z.number()]),
  region: z.string(),
  timezone: z.string(),
})
export type Output = z.output<typeof ZodOutput>

export function parseOutput (output: any[]): Output {
  try {
    const [ip, geoip] = output
    return ZodOutput.parse({ ip, ...geoip })
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
