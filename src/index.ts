/** SDK version of `@taichunmin/bitfinex` */
export const version = process.env.VERSION ?? 'unknown'

export type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from './zod'

export { Bitfinex } from './bitfinex'

export * from './enums'
