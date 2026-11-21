import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { AlertCircle, RotateCw } from 'lucide-react'
import { lazy, Suspense } from 'react'

import { isApiError } from '@/api/client'
import { MonthNavigator } from '@/components/layout/MonthNavigator'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { currentMonth } from '@/lib/months'
import { cn } from '@/lib/utils'

import { RateNotice, RatesUnavailableAlert } from '@/features/currency/components/RateNotice'
import { ACCOUNT_CURRENCY, useDisplayCurrency } from '@/features/currency/display-currency'

import { dashboardQueryOptions } from '../queries'
import { KpiTiles } from './KpiTiles'

// Charts pull in Recharts (~130 kB gzipped). Loading them separately lets the
// KPI tiles render first while the chart code downloads in parallel.
const SpendingByCategory = lazy(() =>
  import('./SpendingByCategory').then((m) => ({ default: m.SpendingByCategory })),
)
const MonthlyTrend = lazy(() => import('./MonthlyTrend').then((m) => ({ default: m.MonthlyTrend })))

const route = getRouteApi('/')

export function DashboardPage() {
  const search = route.useSearch()
  const month = search.month ?? currentMonth()
  // Picked in the app header. The dashboard converts on the server, where it aggregates.
  const [currency] = useDisplayCurrency()

  const converted = useQuery({
    ...dashboardQueryOptions(month, currency),
    placeholderData: keepPreviousData,
  })
  // If rates are unavailable (503), fall back to the account currency.
  const ratesDown = currency !== ACCOUNT_CURRENCY && isApiError(converted.error, 503)
  const fallback = useQuery({
    ...dashboardQueryOptions(month, ACCOUNT_CURRENCY),
    enabled: ratesDown,
  })
  const dashboard = ratesDown ? fallback : converted

  return (
    <>
      <PageHeader title="Dashboard" description="Your income, spending and trends at a glance." />

      <div className="mb-6">
        <MonthNavigator month={month} to="/" />
      </div>

      {ratesDown && (
        <div className="mb-6">
          <RatesUnavailableAlert requested={currency} />
        </div>
      )}

      {dashboard.isPending ? (
        <div role="status" aria-label="Loading dashboard" className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : dashboard.isError && !dashboard.data ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Couldn’t load the dashboard</AlertTitle>
          <AlertDescription>
            <p>{dashboard.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void dashboard.refetch()}
            >
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        // Refetches keep the previous render, dimmed: no skeleton flash.
        <div
          aria-busy={dashboard.isPlaceholderData || undefined}
          className={cn(
            'grid gap-6 transition-opacity',
            dashboard.isPlaceholderData && 'opacity-60',
          )}
        >
          <KpiTiles dashboard={dashboard.data} />
          {dashboard.data.rate && (
            <RateNotice
              rate={dashboard.data.rate}
              note={`Each figure is converted separately from its exact ${dashboard.data.rate.base} value, so categories may not add up to the total to the cent.`}
            />
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<ChartPlaceholder />}>
              <SpendingByCategory
                items={dashboard.data.byCategory}
                currency={dashboard.data.currency}
              />
            </Suspense>
            <Suspense fallback={<ChartPlaceholder />}>
              <MonthlyTrend points={dashboard.data.trend} currency={dashboard.data.currency} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  )
}

function ChartPlaceholder() {
  return <Skeleton role="status" aria-label="Loading chart" className="h-80 rounded-xl" />
}
