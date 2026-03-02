import { z } from 'zod'

export const ZodInput = z.object({
  body: z.record(z.string(), z.coerce.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  path: z.string(),
})
export type Input = z.input<typeof ZodInput>

export const ZodOutput = z.json()
export type Output = z.output<typeof ZodOutput>
