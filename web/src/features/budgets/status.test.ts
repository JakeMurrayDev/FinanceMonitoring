import { describe, expect, it } from 'vitest'

import type { BudgetLine, BudgetStatus } from '@/api/types'

import statusFixture from '../../../../fixtures/budgets/status-cases.json'
import { budgetStatus, percentUsed, totalsOf, withBudget } from './status'

interface StatusCase {
  name: string
  spent: number
  budget: number | null
  status: BudgetStatus
  percentUsed: number | null
}

describe('budgetStatus / percentUsed', () => {
  // Same file as api/tests/.../BudgetStatusParityTests.cs.
  it.each(statusFixture.cases as StatusCase[])('$name', (c) => {
    expect(budgetStatus(c.spent, c.budget)).toBe(c.status)
    expect(percentUsed(c.spent, c.budget)).toBe(c.percentUsed)
  })

  it('stays exact beyond Number.MAX_SAFE_INTEGER / 100', () => {
    const budget = 9_000_000_000_000_000 // $90 trillion: spent × 100 overflows a safe integer
    expect(budgetStatus(budget * 0.8, budget)).toBe('NearLimit')
    expect(percentUsed(budget, budget)).toBe(100)
  })
})

const line = (overrides: Partial<BudgetLine>): BudgetLine => ({
  categoryId: 'groceries',
  categoryName: 'Groceries',
  budget: 30_000,
  budgetEffectiveFrom: '2026-05',
  spent: 30_841,
  remaining: -841,
  percentUsed: 102,
  status: 'OverBudget',
  version: null,
  ...overrides,
})

describe('withBudget', () => {
  it('recalculates everything that depends on the budget', () => {
    expect(withBudget(line({}), 40_000, '2026-11')).toEqual(
      line({
        budget: 40_000,
        budgetEffectiveFrom: '2026-11',
        remaining: 9_159,
        percentUsed: 77,
        status: 'OnTrack',
        version: 1,
      }),
    )
  })

  it('clears a budget', () => {
    expect(withBudget(line({ version: 2 }), null, '2026-11')).toMatchObject({
      budget: null,
      remaining: null,
      percentUsed: null,
      status: 'NoBudget',
      version: 3,
    })
  })
})

describe('totalsOf', () => {
  it('matches the API’s definition of month totals', () => {
    expect(
      totalsOf([
        line({}),
        line({ categoryId: 'rent', budget: 165_000, spent: 165_000, status: 'NearLimit' }),
        line({ categoryId: 'health', budget: null, spent: 2_500, status: 'NoBudget' }),
      ]),
    ).toEqual({
      budgeted: 195_000,
      spentInBudgeted: 195_841,
      remaining: -841,
      unbudgeted: 2_500,
      overBudgetCount: 1,
    })
  })
})
