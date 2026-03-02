import { z } from 'zod'

export const ZodInput = z.object({
  headers: z.record(z.string(), z.string()).optional(),
  path: z.string(),
  query: z.record(z.string(), z.coerce.string()).optional(),
})
export type Input = z.input<typeof ZodInput>

export const ZodOutput = z.json()
export type Output = z.output<typeof ZodOutput>
