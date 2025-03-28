import _ from 'lodash'
import { z } from 'zod'
import * as enums from '../enums'
import { transformMts } from './index'

export const ZodInput = z.object({
  currency: z.string().trim().regex(/^[\w:]+$/).toUpperCase().optional(),
  category: z.nativeEnum(enums.LedgersHistCategory).optional(),
  limit: z.number().int().max(2500).optional(),
  start: z.date().transform(transformMts).optional(),
  end: z.date().transform(transformMts).optional(),
})
export type Input = z.input<typeof ZodInput>

const ZodOutputLedger = z.object({
  amount: z.number(), // AMOUNT: Amount changed
  balance: z.number(), // BALANCE: Balance after change
  currency: z.string().trim(), // CURRENCY: The symbol of the currency (e.g. "BTC")
  description: z.string().trim(), // DESCRIPTION: Description of ledger transaction
  id: z.number().int(), // ID: Ledger identifier
  mts: z.coerce.date(), // MTS: Timestamp in milliseconds
  wallet: z.string().trim().nullable(), // WALLET: Returns the relevant wallet for the ledger entry ('exchange', 'margin', 'funding', 'contribution')
})
const ZodOutput = z.array(ZodOutputLedger)
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  id: 0,
  currency: 1,
  wallet: 2,
  mts: 3,
  amount: 5,
  balance: 6,
  description: 8,
}

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, ledger => ZodOutputLedger.parse(_.mapValues(OUTPUT_INDEX, idx => ledger[idx] ?? null)))
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
