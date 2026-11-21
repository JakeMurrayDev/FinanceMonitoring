import { createFileRoute } from '@tanstack/react-router'

import { BudgetsPage } from '@/features/budgets/components/BudgetsPage'
import { budgetsQueryOptions } from '@/features/budgets/queries'
import { budgetSearchSchema } from '@/features/budgets/search-schema'
import { prefetchDisplayRate } from '@/features/currency/queries'
import { currentMonth } from '@/lib/months'

const ignore = () => undefined

export const Route = createFileRoute('/budgets')({
  validateSearch: budgetSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient.query(budgetsQueryOptions(deps.month ?? currentMonth())).catch(ignore)
    prefetchDisplayRate(queryClient)
  },
  head: () => ({ meta: [{ title: 'Budgets · Finance Monitor' }] }),
  component: BudgetsPage,
})
