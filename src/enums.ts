export enum BitfinexSort {
  ASC = '+1',
  DESC = '-1',
}

export enum LedgersHistCategory {
  Exchange = 5,
  PositionModifiedClosedLiquidated = 22,
  PositionClaim = 23,
  PositionTransfer = 25,
  PositionSwap = 26,
  PositionFundingCostInterestCharged = 27,
  MarginSwapInterestPayment = 28,
  DerivativesFundingEvent = 29,
  Settlement = 31,
  Transfer = 51,
  Deposit = 101,
  Withdrawal = 104,
  CanceledWithdrawal = 105,
  TradingFee = 201,
  TradingRebate = 202,
  HiddenOrderFee = 204,
  OtcTradeFee = 207,
  SwapFee = 222,
  ClaimingFee = 224,
  UsedMarginFundingCharge = 226,
  UnusedMarginFundingFee = 228,
  EarnedFeeAffiliateRebate = 241,
  EthfxLoyaltyFee = 243,
  DepositFee = 251,
  WithdrawalFee = 254,
  WithdrawalExpressFee = 255,
  MinerFee = 258,
  StakingPayment = 262,
  Adjustment = 401,
  Expense = 501,
  CurrencyConversionComputationFee = 905,
  MonthlyProfitPayment = 907,
  Losses = 911,
}

export enum PlatformStatus {
  MAINTENANCE = 0,
  OPERATIVE = 1,
}

export enum V2ConfigRequest {
  'pub:info:currency:restrict' = 'pub:info:currency:restrict',
  'pub:info:pair:fee:ovr' = 'pub:info:pair:fee:ovr',
  'pub:info:pair:restrict' = 'pub:info:pair:restrict',
  'pub:info:tx:status' = 'pub:info:tx:status',
  'pub:list:category:securities' = 'pub:list:category:securities',
  'pub:list:currency:futures' = 'pub:list:currency:futures',
  'pub:list:currency:margin' = 'pub:list:currency:margin',
  'pub:list:currency:paper' = 'pub:list:currency:paper',
  'pub:list:currency:securities:accredited' = 'pub:list:currency:securities:accredited',
  'pub:list:currency:securities:portfolio' = 'pub:list:currency:securities:portfolio',
  'pub:list:currency:securities' = 'pub:list:currency:securities',
  'pub:list:currency:stable' = 'pub:list:currency:stable',
  'pub:list:currency:viewonly' = 'pub:list:currency:viewonly',
  'pub:list:features' = 'pub:list:features',
  'pub:list:pair:cst' = 'pub:list:pair:cst',
  'pub:list:pair:exchange' = 'pub:list:pair:exchange',
  'pub:list:pair:futures' = 'pub:list:pair:futures',
  'pub:list:pair:margin' = 'pub:list:pair:margin',
  'pub:list:pair:securities' = 'pub:list:pair:securities',
  'pub:map:category:futures' = 'pub:map:category:futures',
  'pub:map:category:securities' = 'pub:map:category:securities',
  'pub:map:currency:explorer' = 'pub:map:currency:explorer',
  'pub:map:currency:label' = 'pub:map:currency:label',
  'pub:map:currency:pool' = 'pub:map:currency:pool',
  'pub:map:currency:support:securities' = 'pub:map:currency:support:securities',
  'pub:map:currency:support:zendesk' = 'pub:map:currency:support:zendesk',
  'pub:map:currency:sym' = 'pub:map:currency:sym',
  'pub:map:currency:tx:fee' = 'pub:map:currency:tx:fee',
  'pub:map:currency:unit' = 'pub:map:currency:unit',
  'pub:map:currency:wfx' = 'pub:map:currency:wfx',
  'pub:map:pair:sym' = 'pub:map:pair:sym',
  'pub:map:tx:method:pool' = 'pub:map:tx:method:pool',
  'pub:map:tx:method' = 'pub:map:tx:method',
  'pub:spec:futures' = 'pub:spec:futures',
  'pub:spec:margin' = 'pub:spec:margin',
  'pub:spec:site:maintenance' = 'pub:spec:site:maintenance',
  'pub:spec:ui_denom' = 'pub:spec:ui_denom',
}

export enum FundingAutoStatus {
  deactivate = 0,
  activate = 1,
}
