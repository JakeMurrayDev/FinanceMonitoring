import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: ['categories'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/categories', { signal })).categories,
    // Reference data that never changes while the app is open.
    staleTime: Infinity,
  })
}
