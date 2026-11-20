import { useMutation, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, isApiError, unwrap } from '@/api/client'
import type { BudgetLine, BudgetMonth } from '@/api/types'
import { formatMoney, money } from '@/lib/money'
import { formatMonth } from '@/lib/months'

import { budgetKeys } from './queries'
import { totalsOf, withBudget } from './status'

interface BudgetChange {
  line: BudgetLine
  /** Minor units, or null to clear the budget. */
  amount: number | null
}

/**
 * Set or clear a budget from `month` onward, optimistically. Only the month
 * on screen is patched; every cached month is refetched afterwards, because
 * an effective-dated change also affects later months.
 */
export function useChangeBudget(month: string) {
  return useMutation({
    mutationFn: async ({ line, amount }: BudgetChange) => {
      const path = { categoryId: line.categoryId }
      return amount === null
        ? unwrap(
            await api.DELETE('/api/budgets/{categoryId}', {
              params: { path, query: { month, version: line.version ?? undefined } },
            }),
          )
        : unwrap(
            await api.PUT('/api/budgets/{categoryId}', {
              params: { path },
              body: { month, amount, version: line.version },
            }),
          )
    },
    onMutate: async ({ line, amount }, { client }) => {
      await client.cancelQueries({ queryKey: budgetKeys.month(month) })
      const previous = client.getQueryData<BudgetMonth>(budgetKeys.month(month))
      patchLine(client, month, withBudget(line, amount, month))
      return { previous }
    },
    onSuccess: (updated, { amount }, _result, { client }) => {
      patchLine(client, month, updated)
      toast.success(
        amount === null
          ? `Removed the ${updated.categoryName} budget from ${formatMonth(month)}.`
          : `${updated.categoryName}: ${formatMoney(money(amount, 'USD'))} a month from ${formatMonth(month)}.`,
      )
    },
    onError: (error, { line }, result, { client }) => {
      client.setQueryData(budgetKeys.month(month), result?.previous)
      toast.error(
        isApiError(error, 409)
          ? `The ${line.categoryName} budget was changed elsewhere, so this change wasn’t saved.`
          : `Couldn’t update the ${line.categoryName} budget.`,
        { description: isApiError(error, 409) ? 'Showing the latest budget now.' : error.message },
      )
    },
    onSettled: (_data, _error, _variables, _result, { client }) =>
      client.invalidateQueries({ queryKey: budgetKeys.all }),
  })
}

function patchLine(client: QueryClient, month: string, updated: BudgetLine) {
  client.setQueryData<BudgetMonth>(budgetKeys.month(month), (data) => {
    if (!data) return data
    const lines = data.lines.map((line) =>
      line.categoryId === updated.categoryId ? updated : line,
    )
    return { ...data, lines, totals: totalsOf(lines) }
  })
}
