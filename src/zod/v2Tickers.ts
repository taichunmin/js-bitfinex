import _ from 'lodash'
import { z } from 'zod'
import * as ZodV2Ticker from './v2Ticker'

export const ZodInput = z.object({
  symbols: z.union([
    z.array(z.string().trim()).min(1).transform(symbols => symbols.join(',')),
    z.string().trim(),
  ]).default('ALL'),
})
export type Input = z.input<typeof ZodInput>

const ZodOutput = z.array(ZodV2Ticker.ZodOutput)
export type Output = z.output<typeof ZodOutput>

export function parseOutput (output: any[]): Output {
  try {
    return _.map<any, ZodV2Ticker.Output>(output, ZodV2Ticker.parseOutput)
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
