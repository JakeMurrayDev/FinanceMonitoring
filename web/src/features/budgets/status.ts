import type { BudgetLine, BudgetStatus, BudgetTotals } from '@/api/types'

/** At or above this share of the budget, a category is "near its limit". */
export const NEAR_LIMIT_PERCENT = 80

/**
 * TypeScript twin of the API's BudgetMath, used for optimistic updates so the
 * UI shows the right status before the server answers. Both run
 * fixtures/budgets/status-cases.json, so they can't drift apart.
 *
 * BigInt because spent × 100 can exceed Number.MAX_SAFE_INTEGER for large
 * (still valid) amounts.
 */
export function budgetStatus(spent: number, budget: number | null): BudgetStatus {
  if (budget === null) return 'NoBudget'
  if (spent > budget) return 'OverBudget'
  return BigInt(spent) * 100n >= BigInt(budget) * BigInt(NEAR_LIMIT_PERCENT)
    ? 'NearLimit'
    : 'OnTrack'
}

/** Whole percent used, rounded down (99.9% shows as 99%). */
export function percentUsed(spent: number, budget: number | null): number | null {
  return budget === null ? null : Number((BigInt(spent) * 100n) / BigInt(budget))
}

/** A line as it would be with a different budget, for optimistic updates. */
export function withBudget(line: BudgetLine, budget: number | null, month: string): BudgetLine {
  return {
    ...line,
    budget,
    budgetEffectiveFrom: month,
    remaining: budget === null ? null : budget - line.spent,
    percentUsed: percentUsed(line.spent, budget),
    status: budgetStatus(line.spent, budget),
    version: (line.version ?? 0) + 1,
  }
}

/** Recalculate month totals from lines, mirroring the API. */
export function totalsOf(lines: readonly BudgetLine[]): BudgetTotals {
  const budgeted = lines.filter((line) => line.budget !== null)
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
  const budgetedTotal = sum(budgeted.map((line) => line.budget ?? 0))
  const spentInBudgeted = sum(budgeted.map((line) => line.spent))
  return {
    budgeted: budgetedTotal,
    spentInBudgeted,
    remaining: budgetedTotal - spentInBudgeted,
    unbudgeted: sum(lines.filter((line) => line.budget === null).map((line) => line.spent)),
    overBudgetCount: lines.filter((line) => line.status === 'OverBudget').length,
  }
}
