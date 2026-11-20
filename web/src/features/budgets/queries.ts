import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export const budgetKeys = {
  all: ['budgets'] as const,
  month: (month: string) => [...budgetKeys.all, month] as const,
}

export function budgetsQueryOptions(month: string) {
  return queryOptions({
    queryKey: budgetKeys.month(month),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/budgets', { params: { query: { month } }, signal })),
  })
}
