import { CheckCircle2, CircleDashed, OctagonAlert, TriangleAlert } from 'lucide-react'

import type { BudgetStatus } from '@/api/types'
import { cn } from '@/lib/utils'

const STATUS = {
  OnTrack: { label: 'On track', icon: CheckCircle2, className: 'text-foreground' },
  NearLimit: { label: 'Near limit', icon: TriangleAlert, className: 'text-warning' },
  OverBudget: { label: 'Over budget', icon: OctagonAlert, className: 'text-expense' },
  NoBudget: { label: 'No budget', icon: CircleDashed, className: 'text-muted-foreground' },
} as const

/** Icon plus words: status is never conveyed by colour alone. */
export function BudgetStatusLabel({ status }: { status: BudgetStatus }) {
  const { label, icon: Icon, className } = STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', className)}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </span>
  )
}
