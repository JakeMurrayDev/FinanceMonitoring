import type { BudgetLine, BudgetMonth } from '@/api/types'
import { totalsOf, withBudget } from '@/features/budgets/status'

/**
 * In-memory budgets for tests: one set of lines, served for whichever month
 * is requested. Covers every status. Reset between tests in test/setup.ts.
 *
 * Uses the app's own withBudget/totalsOf to keep state consistent; their
 * correctness is pinned separately by the shared status fixture.
 */
const initial: BudgetLine[] = [
  line('dining', 'Dining Out', 12_000, 10_813, 'NearLimit', 90),
  line('groceries', 'Groceries', 30_000, 30_841, 'OverBudget', 102),
  line('health', 'Health', null, 2_500, 'NoBudget', null),
  line('utilities', 'Utilities', 20_000, 14_352, 'OnTrack', 71),
]

let lines: BudgetLine[] = []

export const budgetDb = {
  reset() {
    lines = structuredClone(initial)
  },
  month(month: string): BudgetMonth {
    return { month, currency: 'USD', lines, totals: totalsOf(lines) }
  },
  /** Mirrors the API: a version is required when a row starts this month. */
  change(
    categoryId: string,
    month: string,
    amount: number | null,
    version: number | null | undefined,
  ) {
    const current = lines.find((l) => l.categoryId === categoryId)
    if (!current) return undefined
    if ((current.version ?? null) !== (version ?? null)) return 'conflict' as const
    const updated = withBudget(current, amount, month)
    lines = lines.map((l) => (l.categoryId === categoryId ? updated : l))
    return updated
  },
}

function line(
  categoryId: string,
  categoryName: string,
  budget: number | null,
  spent: number,
  status: BudgetLine['status'],
  percentUsed: number | null,
): BudgetLine {
  return {
    categoryId,
    categoryName,
    budget,
    budgetEffectiveFrom: budget === null ? null : '2026-05',
    spent,
    remaining: budget === null ? null : budget - spent,
    percentUsed,
    status,
    version: null,
  }
}

budgetDb.reset()
