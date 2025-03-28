import _ from 'lodash'
import { z } from 'zod'
import { ZodJsonValue, transformMts } from './index'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
  end: z.date().transform(transformMts).optional(),
  limit: z.number().int().max(500).default(25),
  start: z.date().transform(transformMts).optional(),
})
export type Input = z.input<typeof ZodInput>

const ZodOutputCredit = z.object({
  amount: z.number(), // AMOUNT: Amount of funds provided
  flags: ZodJsonValue, // FLAGS: Future params object (stay tuned)
  hidden: z.coerce.boolean(), // HIDDEN: 0 if false, 1 if true
  id: z.number().int(), // Loan ID
  mtsCreate: z.coerce.date(), // MTS_CREATE: Millisecond Time Stamp when the loan was created
  mtsLastPayout: z.coerce.date(), // MTS_LAST_PAYOUT: Millisecond Time Stamp for when the last payout was made
  mtsOpening: z.coerce.date(), // MTS_OPENING: Millisecond Time Stamp for when the loan was opened
  mtsUpdate: z.coerce.date(), // MTS_UPDATE: Millisecond Time Stamp when the loan was updated
  noClose: z.coerce.boolean(), // NO_CLOSE: If funding will be returned when position is closed. 0 if false, 1 if true
  notify: z.coerce.boolean(), // NOTIFY: 0 if false, 1 if true
  period: z.number().int(), // PERIOD: Period of the loan
  positionPair: z.string(), // POSITION_PAIR: Pair of the position that the funding was used for
  rate: z.number(), // RATE: Rate of the loan (percentage expressed as decimal number i.e. 1% = 0.01)
  rateType: z.string(), // RATE_TYPE: "FIXED" or "VAR" (for FRR)
  renew: z.coerce.boolean(), // RENEW: 0 if false, 1 if true
  side: z.number().int(), // Side: 1 if you are the lender, 0 if you are both the lender and borrower, -1 if you're the borrower
  status: z.string(), // STATUS: Loan Status: ACTIVE
  symbol: z.string(), // Symbol: The currency of the loan (fUSD, etc)
}).transform(obj => ({ ...obj, currency: obj.symbol.slice(1) }))

const ZodOutput = z.array(ZodOutputCredit)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  id: 0,
  symbol: 1,
  side: 2,
  mtsCreate: 3,
  mtsUpdate: 4,
  amount: 5,
  flags: 6,
  status: 7,
  rateType: 8,
  rate: 11,
  period: 12,
  mtsOpening: 13,
  mtsLastPayout: 14,
  notify: 15,
  hidden: 16,
  renew: 18,
  noClose: 20,
  positionPair: 21,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, credit => ZodOutputCredit.parse(_.mapValues(OUTPUT_INDEX, idx => credit[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
