import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { AlertCircle, RotateCw, TriangleAlert } from 'lucide-react'
import { lazy, Suspense } from 'react'

import { isApiError } from '@/api/client'
import { MonthNavigator } from '@/components/layout/MonthNavigator'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { currentMonth } from '@/lib/months'
import { cn } from '@/lib/utils'

import { ACCOUNT_CURRENCY, useDisplayCurrency } from '../display-currency'
import { dashboardQueryOptions } from '../queries'
import { CurrencyPicker } from './CurrencyPicker'
import { KpiTiles } from './KpiTiles'
import { RateNotice } from './RateNotice'

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
  const [currency, setCurrency] = useDisplayCurrency()

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

      {/* One controls row above everything it scopes. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <MonthNavigator month={month} to="/" />
        <CurrencyPicker value={currency} onChange={setCurrency} />
      </div>

      {ratesDown && (
        <Alert className="mb-6">
          <TriangleAlert aria-hidden="true" className="text-warning" />
          <AlertTitle>Exchange rates are unavailable right now</AlertTitle>
          <AlertDescription>
            Showing amounts in {ACCOUNT_CURRENCY} instead. Try {currency} again later.
          </AlertDescription>
        </Alert>
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
          {dashboard.data.rate && <RateNotice rate={dashboard.data.rate} />}
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
