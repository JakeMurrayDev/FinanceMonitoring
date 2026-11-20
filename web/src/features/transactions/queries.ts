import { queryOptions } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'

import type { TransactionSearch } from './search-schema'

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (search: TransactionSearch) => [...transactionKeys.lists(), search] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  /** Mutation key for creates, so the table can show pending ones. */
  create: () => [...transactionKeys.all, 'create'] as const,
}

/**
 * One factory used by the route loader (prefetch) and the page (useQuery), so
 * both share a cache entry. The whole search object is the key: every filter,
 * sort and page is its own cache entry, and Back/Forward is instant.
 */
export function transactionsQueryOptions(search: TransactionSearch) {
  return queryOptions({
    queryKey: transactionKeys.list(search),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/transactions', { params: { query: search }, signal })),
  })
}

export function transactionQueryOptions(id: string) {
  return queryOptions({
    queryKey: transactionKeys.detail(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/transactions/{id}', { params: { path: { id } }, signal })),
  })
}
