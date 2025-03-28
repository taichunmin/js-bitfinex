import _ from 'lodash'
import { z } from 'zod'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
})
export type Input = z.input<typeof ZodInput>

const ZodOutputOffer = z.object({
  amount: z.number(), // AMOUNT: Amount of the offer
  amountOrig: z.number(), // AMOUNT_ORIG: Amount of the offer when it was first created
  flags: z.any(), // FLAGS: Future params object (stay tuned)
  hidden: z.coerce.boolean(), // HIDDEN: 0 if false, 1 if true
  id: z.number().int(), // ID: Offer ID
  mtsCreate: z.coerce.date(), // MTS_CREATED: Millisecond Time Stamp when the offer was created
  mtsUpdate: z.coerce.date(), // MTS_UPDATED: Millisecond Time Stamp when the offer was updated
  notify: z.coerce.boolean(), // NOTIFY: 0 if false, 1 if true
  period: z.number().int(), // PERIOD: Period of the offer
  rate: z.number(), // RATE: Rate of the offer (percentage expressed as decimal number i.e. 1% = 0.01)
  renew: z.coerce.boolean(), // RENEW: 0 if false, 1 if true
  status: z.string(), // STATUS: Offer Status: ACTIVE, PARTIALLY FILLED
  symbol: z.string(), // SYMBOL: The currency of the offer (fUSD, etc)
  type: z.string(), // TYPE: "LIMIT, ..."
}).transform(obj => ({ ...obj, currency: obj.symbol.slice(1) }))
const ZodOutput = z.array(ZodOutputOffer)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  id: 0,
  symbol: 1,
  mtsCreate: 2,
  mtsUpdate: 3,
  amount: 4,
  amountOrig: 5,
  type: 6,
  flags: 9,
  status: 10,
  rate: 14,
  period: 15,
  notify: 16,
  hidden: 17,
  renew: 19,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, offer => ZodOutputOffer.parse(_.mapValues(OUTPUT_INDEX, idx => offer[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
