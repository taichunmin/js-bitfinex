import { z } from 'zod'

const ZodInputConfigKey = z.string().trim().regex(/^[\w:]+$/)

export const ZodInput = z.union([
  ZodInputConfigKey.transform(configKey => [configKey]),
  z.array(ZodInputConfigKey).min(1),
]).optional()
export type Input = z.input<typeof ZodInput>
