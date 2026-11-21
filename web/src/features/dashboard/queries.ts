import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  month: (month: string, currency: string) => [...dashboardKeys.all, month, currency] as const,
}

export function dashboardQueryOptions(month: string, currency: string) {
  return queryOptions({
    queryKey: dashboardKeys.month(month, currency),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/dashboard', { params: { query: { month, currency } }, signal })),
  })
}
