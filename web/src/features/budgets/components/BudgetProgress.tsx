import type { BudgetLine } from '@/api/types'
import { formatMoney, money } from '@/lib/money'
import { cn } from '@/lib/utils'

const BAR_STYLE = {
  OnTrack: 'bg-primary',
  NearLimit: 'bg-warning',
  // Stripes, not just a colour change, mark the overspend.
  OverBudget:
    'bg-[repeating-linear-gradient(135deg,var(--color-expense)_0_6px,color-mix(in_oklab,var(--color-expense)_55%,transparent)_6px_12px)]',
  NoBudget: 'bg-muted-foreground',
} as const

const usd = (minor: number) => formatMoney(money(minor, 'USD'))

/**
 * An accessible progress bar: screen readers hear "$308.41 of $300.00 spent,
 * 102%" rather than a bare number. The value is capped at 100 because
 * aria-valuenow can't exceed aria-valuemax; the text carries the real figure.
 */
export function BudgetProgress({ line, labelledBy }: { line: BudgetLine; labelledBy: string }) {
  if (line.budget === null || line.percentUsed === null) return null
  const width = Math.min(line.percentUsed, 100)

  return (
    <div
      role="progressbar"
      aria-labelledby={labelledBy}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-valuetext={`${usd(line.spent)} of ${usd(line.budget)} spent, ${String(line.percentUsed)}%`}
      className="h-2.5 overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          BAR_STYLE[line.status],
        )}
        style={{ width: `${String(width)}%` }}
      />
    </div>
  )
}
