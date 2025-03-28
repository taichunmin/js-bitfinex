import _ from 'lodash'
import { z } from 'zod'
import * as enums from '../enums'
import * as utils from '../utils'

const ZodInputDeactivate = z.object({
  status: z.literal(enums.FundingAutoStatus.deactivate),
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
})

const ZodInputActivate = z.object({
  status: z.literal(enums.FundingAutoStatus.activate),
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase(),
  period: z.number().int().min(2).max(120).optional(),
  amount: z.union([
    z.string().trim(),
    z.number().min(0).transform(utils.formatAmount),
  ]).optional(),
  rate: z.union([
    z.string().trim(),
    z.number().min(0).transform(utils.formatAmount),
  ]).optional(),
})

export const ZodInput = z.discriminatedUnion('status', [
  ZodInputDeactivate,
  ZodInputActivate,
])

export type Input = z.input<typeof ZodInput>

const ZodOutputOffer = z.object({
  currency: z.string(), // CURRENCY: Currency (USD, …)
  period: z.number().int(), // PERIOD: Period in days
  rate: z.number(), // RATE: Rate of the offer (percentage expressed as decimal number i.e. 1% = 0.01)
  threshold: z.number(), // THRESHOLD: Max amount to be auto-renewed
})

const ZodOutput = z.object({
  mts: z.coerce.date(), // MTS: Seconds epoch timestamp of notification
  type: z.string(), // TYPE: Notification's type ("fa-req")
  msgId: z.number().int().nullable(), // MESSAGE_ID: Unique notification's ID
  offer: ZodOutputOffer.nullable(), // FUNDING_OFFER_ARRAY: An array containing data for the funding offer
  code: z.number().int().nullable(), // CODE: W.I.P. (work in progress)
  status: z.string(), // STATUS: Status of the notification; it may vary over time (SUCCESS, ERROR, FAILURE, ...)
  text: z.string(), // TEXT: Additional notification description
})
export type Output = z.output<typeof ZodOutput>

const OFFER_INDEX = {
  currency: 0,
  period: 1,
  rate: 2,
  threshold: 3,
}

const OUTPUT_INDEX: Record<string, number> = {
  mts: 0,
  type: 1,
  msgId: 2,
  // offer: 4,
  code: 5,
  status: 6,
  text: 7,
}

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse({
      ..._.mapValues(OUTPUT_INDEX, idx => output?.[idx] ?? null),
      offer: ZodOutputOffer.parse(_.mapValues(OFFER_INDEX, idx => output[4]?.[idx] ?? null)),
    })
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
