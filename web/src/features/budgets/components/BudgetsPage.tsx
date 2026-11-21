import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { AlertCircle, RotateCw } from 'lucide-react'

import { MonthNavigator } from '@/components/layout/MonthNavigator'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DisplayCurrencyNotice } from '@/features/currency/components/RateNotice'
import { currentMonth, formatMonth } from '@/lib/months'
import { cn } from '@/lib/utils'

import { useChangeBudget } from '../mutations'
import { budgetsQueryOptions } from '../queries'
import { BudgetCard } from './BudgetCard'
import { BudgetSummary } from './BudgetSummary'

const route = getRouteApi('/budgets')

export function BudgetsPage() {
  const search = route.useSearch()
  const month = search.month ?? currentMonth()
  const budgets = useQuery({ ...budgetsQueryOptions(month), placeholderData: keepPreviousData })
  const changeBudget = useChangeBudget(month)

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monthly spending limits for each expense category."
      />
      <div className="mb-6">
        <MonthNavigator month={month} to="/budgets" />
      </div>

      <div className="mb-6 empty:hidden">
        <DisplayCurrencyNotice note="Budgets are set in USD. Each figure is converted separately from its exact USD value, so they may not add up to the cent." />
      </div>

      {budgets.isPending ? (
        <div
          role="status"
          aria-label="Loading budgets"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : budgets.isError && !budgets.data ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Couldn’t load budgets</AlertTitle>
          <AlertDescription>
            <p>{budgets.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void budgets.refetch()}
            >
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div
          aria-busy={budgets.isPlaceholderData || undefined}
          className={cn(budgets.isPlaceholderData && 'opacity-60')}
        >
          <BudgetSummary totals={budgets.data.totals} lines={budgets.data.lines} />

          {budgets.data.lines.every((line) => line.budget === null && line.spent === 0) && (
            <p className="mb-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No budgets or spending in {formatMonth(month)} yet. Set a budget on any category to
              start tracking it.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.data.lines.map((line) => (
              <BudgetCard
                key={line.categoryId}
                line={line}
                month={month}
                onChange={(amount) => {
                  changeBudget.mutate({ line, amount })
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
