import _ from 'lodash'
import { z } from 'zod'
import { ZodJsonObject } from './index'

const ZodOutputWallet = z.object({
  availableBalance: z.number(), // Wallet balance available for orders/withdrawal/transfer
  balance: z.number(), // Balance
  currency: z.string(), // Currency (e.g. USD, BTC, ETH, ...)
  lastChange: ZodJsonObject,
  type: z.string(), // Wallet name (exchange, margin, funding)
  unsettledInterest: z.number(), // Unsettled interest
})
const ZodOutput = z.array(ZodOutputWallet)
export type Output = z.output<typeof ZodOutput>

export function parseOutput (output: any[]): Output {
  try {
    return _.map(output, ([type, currency, balance, unsettledInterest, availableBalance, lastChangeDesc, lastChange]) => {
      const tmp = _.omitBy({ ...(lastChange ?? {}), desc: lastChangeDesc }, _.isNil)
      return ZodOutputWallet.parse({ type, currency, balance, unsettledInterest, availableBalance, lastChange: tmp })
    })
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
