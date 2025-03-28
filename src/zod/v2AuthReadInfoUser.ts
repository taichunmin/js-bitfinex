import _ from 'lodash'
import { z } from 'zod'

// v2AuthReadInfoUser
const ZodOutput = z.object({
  company: z.string(), // COMPANY: Shows where the account is registered. Accounts registered at Bitfinex will show 'bitfinex' and accounts registered at eosfinex will show 'eosfinex'
  compCountries: z.array(z.string()), // COMP_COUNTRIES: Array of country codes based on your verification data (residence and nationality)
  compCountriesResid: z.array(z.string()), // COMP_COUNTRIES_RESID: Array of country codes based on your verification data (residence only)
  competitionEnabled: z.coerce.boolean(), // COMPETITION_ENABLED: 1 if true (for competition accounts)
  complAccountType: z.string(), // COMPL_ACCOUNT_TYPE: Type of compliance verification ("individual" or "corporate")
  email: z.string(), // EMAIL: Account Email
  id: z.number().int(), // ID: Account ID
  locale: z.string().nullable(), // LOCALE: Account locale setting
  modes2FA: z.array(z.string()), // 2FA_MODES: Array of enabled 2FA modes ('u2f', 'otp')
  mtsAccountCreate: z.coerce.date(), // MTS_ACCOUNT_CREATE: Millisecond timestamp of account creation
  pptEnabled: z.coerce.boolean(), // PPT_ENABLED: 1 if true (for paper trading accounts)
  timeLastLogin: z.coerce.date().nullable(), // TIME_LAST_LOGIN: Date and time of last login
  timezone: z.string(), // TIMEZONE: Account timezone setting
  username: z.string(), // USERNAME: Account Username
  ctxSwitch: z.object({
    allowDisable: z.coerce.boolean(), // ALLOW_DISABLE_CTXSWITCH: Account can disable context switching by master account into this account (1 if true)
    disabled: z.coerce.boolean(), // CTXSWITCH_DISABLED: Master account cannot context switch into this account (1 if true)
  }),
  masterAccount: z.object({
    groupId: z.number().int().nullable(), // GROUP_ID: Account group ID
    groupWithdrawEnabled: z.coerce.boolean(), // GROUP_WITHDRAW_ENABLED: 1 if enabled
    id: z.number().int().nullable(), // MASTER_ACCOUNT_ID: The ID of the master account, If the account is a sub-account.
    inheritVerification: z.coerce.boolean(), // INHERIT_MASTER_ACCOUNT_VERIFICATION: 1 if account inherits verification from master account
    isGroupMaster: z.coerce.boolean(), // IS_GROUP_MASTER: 1 if account is a master account
    mtsCreate: z.coerce.date().nullable(), // MTS_MASTER_ACCOUNT_CREATE: Millisecond timestamp of master account creation
  }),
  merchant: z.object({
    enabled: z.coerce.boolean(), // MERCHANT_ENABLED: 1 if true (for merchant accounts)
    isEnterprise: z.coerce.boolean(), // IS_MERCHANT_ENTERPRISE: 1 if true (when account is enterprise merchant)
  }),
  securities: z.object({
    enabled: z.coerce.boolean(), // SECURITIES_ENABLED: 1 if true (for securities accounts)
    isElSalvador: z.coerce.boolean(), // IS_SECURITIES_EL_SALVADOR: 1 if true (if an account is verified for El Salvador securities)
    isInvestorAccredited: z.coerce.boolean(), // IS_SECURITIES_INVESTOR_ACCREDITED: 1 if true (when an account is accredited investor verified)
    isMaster: z.coerce.boolean(), // IS_SECURITIES_MASTER: 1 if true (when the account has a securities sub-account)
  }),
  verification: z.object({
    email: z.coerce.boolean(), // EMAIL_VERIFIED: 1 if true
    level: z.number().int(), // VERIFICATION_LEVEL: Account verification level
    levelSubmitted: z.number().int(), // VERIFICATION_LEVEL_SUBMITTED: Level of highest verification application submitted from the account
    verified: z.coerce.boolean(), // VERIFIED: Indicates if the user has a verified status (KYC) 1 = true, 0 = false
  }),
})
export type Output = z.output<typeof ZodOutput>

const OUTPUT_INDEX: Record<string, number> = {
  company: 9,
  compCountries: 49,
  compCountriesResid: 50,
  competitionEnabled: 23,
  complAccountType: 51,
  email: 1,
  id: 0,
  locale: 8,
  modes2FA: 26,
  mtsAccountCreate: 3,
  pptEnabled: 21,
  timeLastLogin: 44,
  timezone: 7,
  username: 2,
}

const CTX_SWITCH_INDEX: Record<string, number> = {
  allowDisable: 38,
  disabled: 39,
}

const MASTER_ACCOUNT_INDEX: Record<string, number> = {
  groupId: 15,
  groupWithdrawEnabled: 19,
  id: 16,
  inheritVerification: 17,
  isGroupMaster: 18,
  mtsCreate: 14,
}

const MERCHANT_INDEX: Record<string, number> = {
  enabled: 22,
  isEnterprise: 54,
}

const SECURITIES_INDEX: Record<string, number> = {
  enabled: 29,
  isElSalvador: 31,
  isInvestorAccredited: 30,
  isMaster: 28,
}

const VERIFICATION_INDEX: Record<string, number> = {
  email: 10,
  level: 5,
  levelSubmitted: 47,
  verified: 4,
}

export function parseOutput (output: any[]): Output {
  try {
    return ZodOutput.parse({
      ..._.mapValues(OUTPUT_INDEX, idx => output?.[idx] ?? null),
      ctxSwitch: _.mapValues(CTX_SWITCH_INDEX, idx => output?.[idx] ?? null),
      masterAccount: _.mapValues(MASTER_ACCOUNT_INDEX, idx => output?.[idx] ?? null),
      merchant: _.mapValues(MERCHANT_INDEX, idx => output?.[idx] ?? null),
      securities: _.mapValues(SECURITIES_INDEX, idx => output?.[idx] ?? null),
      verification: _.mapValues(VERIFICATION_INDEX, idx => output?.[idx] ?? null),
    })
  } catch (err) {
    throw _.update(err, 'data.parseOutput', orig => orig ?? { output })
  }
}
