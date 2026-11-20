import { z } from 'zod'

import { isMonth } from '@/lib/months'

/** /budgets?month=2026-11. No month (or an invalid one) means the current month. */
export const budgetSearchSchema = z.object({
  month: z.string().refine(isMonth).optional().catch(undefined),
})
