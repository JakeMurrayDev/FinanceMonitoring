import { OctagonAlert } from 'lucide-react'

import type { BudgetLine, BudgetTotals } from '@/api/types'
import { formatMoney, money } from '@/lib/money'
import { cn } from '@/lib/utils'

const usd = (minor: number) => formatMoney(money(minor, 'USD'))

export function BudgetSummary({
  totals,
  lines,
}: {
  totals: BudgetTotals
  lines: readonly BudgetLine[]
}) {
  const over = lines.filter((line) => line.status === 'OverBudget')
  const anyBudget = lines.some((line) => line.budget !== null)
  const overspent = totals.remaining < 0

  return (
    <section aria-label="Month summary" className="mb-6 grid gap-4">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Budgeted" value={usd(totals.budgeted)} />
        <Stat label="Spent" value={usd(totals.spentInBudgeted)} hint="In budgeted categories" />
        <Stat
          label={overspent ? 'Over budget' : 'Left to spend'}
          value={usd(Math.abs(totals.remaining))}
          className={overspent ? 'text-expense' : undefined}
        />
      </dl>

      {totals.unbudgeted > 0 && (
        <p className="text-sm text-muted-foreground">
          Plus {usd(totals.unbudgeted)} spent in categories without a budget.
        </p>
      )}

      {/* Announced when it changes, e.g. after editing a budget. */}
      <p
        role="status"
        className={cn(
          'flex items-center gap-2 text-sm',
          over.length > 0 ? 'font-medium text-expense' : 'text-muted-foreground',
          !anyBudget && 'sr-only',
        )}
      >
        {over.length > 0 && <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />}
        {over.length > 0
          ? `${String(over.length)} ${over.length === 1 ? 'category is' : 'categories are'} over budget: ${over.map((line) => line.categoryName).join(', ')}.`
          : anyBudget
            ? 'Every budgeted category is within its limit.'
            : ''}
      </p>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('mt-1 text-2xl font-semibold', className)}>{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}
