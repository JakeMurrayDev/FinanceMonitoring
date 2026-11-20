import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import type { Dashboard } from '@/api/types'
import { addMonths } from '@/lib/months'
import { cn } from '@/lib/utils'

import {
  describeChange,
  describeRateChange,
  formatAmount,
  formatBasisPoints,
  type Change,
} from '../insights'

export function KpiTiles({ dashboard }: { dashboard: Dashboard }) {
  const { totals, previous, currency } = dashboard
  const previousMonth = addMonths(dashboard.month, -1)

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Income"
        value={formatAmount(totals.income, currency)}
        change={describeChange(totals.income, previous.income, previousMonth, true)}
      />
      <Tile
        label="Expenses"
        value={formatAmount(totals.expenses, currency)}
        change={describeChange(totals.expenses, previous.expenses, previousMonth, false)}
      />
      <Tile
        label="Net"
        value={formatAmount(totals.net, currency)}
        change={describeChange(totals.net, previous.net, previousMonth, true)}
      />
      <Tile
        label="Savings rate"
        value={
          dashboard.savingsRateBasisPoints === null
            ? '—'
            : formatBasisPoints(dashboard.savingsRateBasisPoints)
        }
        change={describeRateChange(dashboard.savingsRateBasisPoints, previous, previousMonth)}
      />
    </dl>
  )
}

const ICON = { up: ArrowUpRight, down: ArrowDownRight, none: Minus } as const
const TONE = { good: 'text-income', bad: 'text-expense', neutral: 'text-muted-foreground' } as const

function Tile({ label, value, change }: { label: string; value: string; change: Change }) {
  const Icon = ICON[change.direction]
  return (
    <div className="rounded-xl border bg-card p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      {/* Proportional sans figures for a standalone number (no tabular/mono). */}
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
      <dd className={cn('mt-1 flex items-center gap-1 text-sm', TONE[change.tone])}>
        <Icon aria-hidden="true" className="size-4" />
        {change.text}
      </dd>
    </div>
  )
}
