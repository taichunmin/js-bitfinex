import { z } from 'zod'
import * as enums from '../enums'

export * from 'zod'

export type JsonArray = JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

// JSON type: https://zod.dev/?id=json-type
export const ZodJsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()])
export const ZodJsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  ZodJsonPrimitive,
  z.array(ZodJsonValue),
  z.record(ZodJsonValue),
]))
export const ZodJsonObject = z.record(ZodJsonValue)
export const ZodJsonArray = z.array(ZodJsonValue)

export const ZodAnyToUndefined = z.any().transform(() => undefined)

// enums
export const ZodBitfinexSort = z.nativeEnum(enums.BitfinexSort)

// transforms
export function transformMts (val: Date): number {
  return val instanceof Date ? val.getTime() : val
}
