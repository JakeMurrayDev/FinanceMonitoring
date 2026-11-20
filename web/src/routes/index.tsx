import { createFileRoute } from '@tanstack/react-router'

import { DashboardPage } from '@/features/dashboard/components/DashboardPage'
import { getDisplayCurrency } from '@/features/dashboard/display-currency'
import { currenciesQueryOptions, dashboardQueryOptions } from '@/features/dashboard/queries'
import { monthSearchSchema } from '@/lib/month-search'
import { currentMonth } from '@/lib/months'

const ignore = () => undefined

export const Route = createFileRoute('/')({
  validateSearch: monthSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient
      .query(dashboardQueryOptions(deps.month ?? currentMonth(), getDisplayCurrency()))
      .catch(ignore)
    void queryClient.query(currenciesQueryOptions()).catch(ignore)
  },
  head: () => ({ meta: [{ title: 'Dashboard · Finance Monitor' }] }),
  component: DashboardPage,
})
