import { useEffect, useId, useRef, useState } from 'react'

import type { BudgetLine } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDisplayMoney } from '@/features/currency/use-display-money'
import { formatMonth } from '@/lib/months'
import { cn } from '@/lib/utils'

import { BudgetEditor } from './BudgetEditor'
import { BudgetProgress } from './BudgetProgress'
import { BudgetStatusLabel } from './BudgetStatusLabel'

interface BudgetCardProps {
  line: BudgetLine
  month: string
  /** Minor units, or null to remove the budget from this month on. */
  onChange: (amount: number | null) => void
}

export function BudgetCard({ line, month, onChange }: BudgetCardProps) {
  const titleId = useId()
  const { format } = useDisplayMoney()
  const [editing, setEditing] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  // After closing the editor or removing a budget, the focused control
  // disappears; put focus back on this card's actions instead of losing it.
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (restoreFocus.current) {
      restoreFocus.current = false
      actionsRef.current?.querySelector('button')?.focus()
    }
  })

  const done = () => {
    restoreFocus.current = true
    setEditing(false)
  }

  const hasBudget = line.budget !== null

  return (
    <Card aria-labelledby={titleId} role="group" className="gap-4">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle id={titleId} className="text-base">
          <h2>{line.categoryName}</h2>
        </CardTitle>
        <BudgetStatusLabel status={line.status} />
      </CardHeader>

      <CardContent className="grid gap-3">
        <p className="font-mono text-lg tabular-nums">
          {format(line.spent)}
          <span className="text-sm text-muted-foreground">
            {line.budget === null ? ' spent' : ` of ${format(line.budget)}`}
          </span>
        </p>

        <BudgetProgress line={line} labelledBy={titleId} />

        {line.remaining !== null && (
          <p
            className={cn(
              'text-sm',
              line.remaining < 0 ? 'font-medium text-expense' : 'text-muted-foreground',
            )}
          >
            {line.remaining < 0
              ? `${format(-line.remaining)} over budget`
              : `${format(line.remaining)} left`}
          </p>
        )}

        {line.budgetEffectiveFrom && hasBudget && (
          <p className="text-xs text-muted-foreground">
            {line.budgetEffectiveFrom === month
              ? `Set from ${formatMonth(month)}`
              : `Budget since ${formatMonth(line.budgetEffectiveFrom)}`}
          </p>
        )}

        {editing ? (
          <BudgetEditor
            line={line}
            month={month}
            onCancel={done}
            onSave={(amount) => {
              onChange(amount)
              done()
            }}
          />
        ) : (
          <div ref={actionsRef} className="flex gap-2">
            <Button
              size="sm"
              variant={hasBudget ? 'outline' : 'default'}
              onClick={() => {
                setEditing(true)
              }}
            >
              {/* The space sits outside the span: name computation trims inside it. */}
              {hasBudget ? 'Edit' : 'Set budget'}{' '}
              <span className="sr-only">
                {hasBudget ? `${line.categoryName} budget` : `for ${line.categoryName}`}
              </span>
            </Button>
            {hasBudget && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  restoreFocus.current = true
                  onChange(null)
                }}
              >
                Remove <span className="sr-only">{line.categoryName} budget</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
