import { type ArrayValues } from 'type-fest'

export enum PlatformStatus {
  MAINTENANCE = 0,
  OPERATIVE = 1,
}

export enum BitfinexSort {
  ASC = '+1',
  DESC = '-1',
}

export const V2ConfigRequestConst = [
  'pub:info:currency:restrict',
  'pub:info:pair:fee:ovr',
  'pub:info:pair:restrict',
  'pub:info:tx:status',
  'pub:list:category:securities',
  'pub:list:currency:futures',
  'pub:list:currency:margin',
  'pub:list:currency:paper',
  'pub:list:currency:securities:accredited',
  'pub:list:currency:securities:portfolio',
  'pub:list:currency:securities',
  'pub:list:currency:stable',
  'pub:list:currency:viewonly',
  'pub:list:features',
  'pub:list:pair:cst',
  'pub:list:pair:exchange',
  'pub:list:pair:futures',
  'pub:list:pair:margin',
  'pub:list:pair:securities',
  'pub:map:category:futures',
  'pub:map:category:securities',
  'pub:map:currency:explorer',
  'pub:map:currency:label',
  'pub:map:currency:pool',
  'pub:map:currency:support:securities',
  'pub:map:currency:support:zendesk',
  'pub:map:currency:sym',
  'pub:map:currency:tx:fee',
  'pub:map:currency:unit',
  'pub:map:currency:wfx',
  'pub:map:pair:sym',
  'pub:map:tx:method:pool',
  'pub:map:tx:method',
  'pub:spec:futures',
  'pub:spec:margin',
  'pub:spec:site:maintenance',
  'pub:spec:ui_denom',
] as const

export type V2ConfigRequest = ArrayValues<typeof V2ConfigRequestConst>
