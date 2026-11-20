import { describe, expect, it } from 'vitest'

import {
  describeChange,
  describeRateChange,
  summariseCategories,
  summariseTrend,
  topCategories,
} from './insights'

describe('describeChange', () => {
  it('says which way it moved, and whether that is good', () => {
    expect(describeChange(120, 100, '2026-10', true)).toEqual({
      direction: 'up',
      tone: 'good',
      text: 'Up 20% from October',
    })
    expect(describeChange(120, 100, '2026-10', false)).toEqual({
      direction: 'up',
      tone: 'bad',
      text: 'Up 20% from October',
    })
    expect(describeChange(50, 100, '2026-10', false)).toMatchObject({
      direction: 'down',
      tone: 'good',
      text: 'Down 50% from October',
    })
  })

  it('measures change from a negative month against its size', () => {
    // Net went from −100 to +100: up 200%.
    expect(describeChange(100, -100, '2026-10', true).text).toBe('Up 200% from October')
  })

  it('handles an empty previous month and no change', () => {
    expect(describeChange(500, 0, '2026-10', true).text).toBe('None in October')
    expect(describeChange(0, 0, '2026-10', true).text).toBe('No change from October')
    expect(describeChange(1001, 1000, '2026-10', true).text).toBe('About the same as October')
  })
})

describe('describeRateChange', () => {
  it('reports percentage points', () => {
    // Previous: 15,000 / 20,000 = 75.00%; current 56.65% → down 18.4 pts
    expect(
      describeRateChange(5665, { income: 20_000, expenses: 5_000, net: 15_000 }, '2026-10'),
    ).toEqual({
      direction: 'down',
      tone: 'bad',
      text: 'Down 18.4 pts from October',
    })
  })
})

const spend = (name: string, amount: number) => ({ categoryId: name.toLowerCase(), name, amount })

describe('topCategories', () => {
  it('keeps up to seven rows, folding the tail into Other', () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((n, i) => spend(n, 100 - i))
    const top = topCategories(items)
    expect(top.map((c) => c.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'Other (2)'])
    expect(top.at(-1)?.amount).toBe(94 + 93)
    expect(topCategories(items.slice(0, 7))).toHaveLength(7) // no point folding a single row
  })
})

describe('summaries', () => {
  it('names the largest category and its share', () => {
    expect(summariseCategories([spend('Rent', 165_000), spend('Groceries', 35_000)], 'USD')).toBe(
      'Rent is the largest expense at $1,650.00, 83% of spending across 2 categories.',
    )
  })

  it('summarises the trend', () => {
    expect(
      summariseTrend(
        [
          { month: '2026-10', income: 20_000, expenses: 5_000, net: 15_000 },
          { month: '2026-11', income: 1_000, expenses: 13_003, net: -12_003 },
        ],
        'EUR',
      ),
    ).toBe('Net was positive in 1 of 2 months. Highest spending: November 2026 at €130.03.')
  })
})
