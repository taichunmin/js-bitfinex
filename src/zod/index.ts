import { z } from 'zod'
import * as enums from '../enums'

export * from 'zod'

export type JsonValue = z.output<z.ZodJSONSchema>

export const ZodAnyToUndefined = z.any().transform(() => undefined)

// enums
export const ZodBitfinexSort = z.nativeEnum(enums.BitfinexSort)

// transforms
export function transformMts (val: Date): number {
  return val instanceof Date ? val.getTime() : val
}
