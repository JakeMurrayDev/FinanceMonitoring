import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

import { ACCOUNT_CURRENCY, getDisplayCurrency } from './display-currency'

export const rateKeys = {
  all: ['rates'] as const,
  currency: (currency: string) => [...rateKeys.all, currency] as const,
}

export function currenciesQueryOptions() {
  return queryOptions({
    queryKey: ['currencies'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/currencies', { signal })).currencies,
    staleTime: 60 * 60 * 1000,
  })
}

/** USD → `currency`. The ECB publishes once a working day; the API caches for an hour. */
export function rateQueryOptions(currency: string) {
  return queryOptions({
    queryKey: rateKeys.currency(currency),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/rates/{currency}', { params: { path: { currency } }, signal })),
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * For route loaders: start fetching the display rate alongside the page's
 * data, so amounts appear already converted. Never throws; the page shows
 * its own fallback if the rate can't be had.
 */
export function prefetchDisplayRate(queryClient: QueryClient) {
  const currency = getDisplayCurrency()
  if (currency !== ACCOUNT_CURRENCY) {
    void queryClient.query(rateQueryOptions(currency)).catch(() => undefined)
  }
}
