import { z } from 'zod'

import { isMonth } from './months'

/** `?month=2026-11` for month-based pages. Missing or invalid means the current month. */
export const monthSearchSchema = z.object({
  month: z.string().refine(isMonth).optional().catch(undefined),
})
