import type { CategorySpend, MonthTotals, TrendPoint } from '@/api/types'
import { formatMoney, money } from '@/lib/money'
import { formatMonth } from '@/lib/months'

export const formatAmount = (minor: number, currency: string) => formatMoney(money(minor, currency))

export interface Change {
  direction: 'up' | 'down' | 'none'
  /** Whether the move is good news. Shown as colour, but always alongside the arrow and words. */
  tone: 'good' | 'bad' | 'neutral'
  text: string
}

/**
 * Change from the previous month for a KPI tile, in words: the arrow and
 * colour repeat it, never replace it. `upIsGood` decides the tone.
 */
export function describeChange(
  current: number,
  previous: number,
  previousMonth: string,
  upIsGood: boolean,
): Change {
  const monthName = formatMonth(previousMonth).split(' ')[0] ?? previousMonth
  if (previous === 0) {
    return {
      direction: 'none',
      tone: 'neutral',
      text: current === 0 ? `No change from ${monthName}` : `None in ${monthName}`,
    }
  }
  const percent = Math.round(((current - previous) * 100) / Math.abs(previous))
  if (percent === 0)
    return { direction: 'none', tone: 'neutral', text: `About the same as ${monthName}` }
  const up = percent > 0
  return {
    direction: up ? 'up' : 'down',
    tone: up === upIsGood ? 'good' : 'bad',
    text: `${up ? 'Up' : 'Down'} ${String(Math.abs(percent))}% from ${monthName}`,
  }
}

/** Savings-rate change in percentage points (rates in basis points). */
export function describeRateChange(
  current: number | null,
  previous: MonthTotals,
  previousMonth: string,
): Change {
  const monthName = formatMonth(previousMonth).split(' ')[0] ?? previousMonth
  if (current === null || previous.income === 0) {
    return { direction: 'none', tone: 'neutral', text: `No comparison with ${monthName}` }
  }
  const previousRate = Math.trunc((previous.net * 10_000) / previous.income)
  const points = (current - previousRate) / 100
  if (Math.abs(points) < 0.05)
    return { direction: 'none', tone: 'neutral', text: `Same as ${monthName}` }
  const up = points > 0
  return {
    direction: up ? 'up' : 'down',
    tone: up ? 'good' : 'bad',
    text: `${up ? 'Up' : 'Down'} ${Math.abs(points).toFixed(1)} pts from ${monthName}`,
  }
}

export const formatBasisPoints = (bp: number) => `${(bp / 100).toFixed(1)}%`

/** Top categories plus "Other", so the chart never needs more than one colour or seven rows. */
export function topCategories(items: readonly CategorySpend[], limit = 6): CategorySpend[] {
  if (items.length <= limit + 1) return [...items]
  const rest = items.slice(limit)
  return [
    ...items.slice(0, limit),
    {
      categoryId: 'other',
      name: `Other (${String(rest.length)})`,
      amount: rest.reduce((sum, c) => sum + c.amount, 0),
    },
  ]
}

/** One-sentence takeaway for the category chart: its accessible summary. */
export function summariseCategories(items: readonly CategorySpend[], currency: string): string {
  const [largest] = items
  if (!largest) return 'No spending this month.'
  const total = items.reduce((sum, c) => sum + c.amount, 0)
  const share = Math.round((largest.amount * 100) / total)
  return `${largest.name} is the largest expense at ${formatAmount(largest.amount, currency)}, ${String(share)}% of spending across ${String(items.length)} ${items.length === 1 ? 'category' : 'categories'}.`
}

/** One-sentence takeaway for the trend chart. */
export function summariseTrend(points: readonly TrendPoint[], currency: string): string {
  if (points.every((p) => p.income === 0 && p.expenses === 0))
    return 'No activity in these six months.'
  const positive = points.filter((p) => p.net > 0).length
  const highest = points.reduce((a, b) => (b.expenses > a.expenses ? b : a))
  return `Net was positive in ${String(positive)} of ${String(points.length)} months. Highest spending: ${formatMonth(highest.month)} at ${formatAmount(highest.expenses, currency)}.`
}
