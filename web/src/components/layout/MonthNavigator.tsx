import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { addMonths, currentMonth, formatMonth } from '@/lib/months'

/** Previous / next month links for a page with `?month=` in its URL. */
export function MonthNavigator({ month, to }: { month: string; to: '/' | '/budgets' }) {
  const previous = addMonths(month, -1)
  const next = addMonths(month, 1)

  return (
    <nav aria-label="Month" className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon">
        <Link
          to={to}
          search={(prev) => ({ ...prev, month: previous })}
          aria-label={`Previous month, ${formatMonth(previous)}`}
        >
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>
      <p className="min-w-40 text-center text-lg font-semibold" aria-live="polite">
        {formatMonth(month)}
      </p>
      <Button asChild variant="outline" size="icon">
        <Link
          to={to}
          search={(prev) => ({ ...prev, month: next })}
          aria-label={`Next month, ${formatMonth(next)}`}
        >
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
      {month !== currentMonth() && (
        <Button asChild variant="ghost" size="sm">
          <Link to={to} search={(prev) => ({ ...prev, month: undefined })}>
            Back to this month
          </Link>
        </Button>
      )}
    </nav>
  )
}
