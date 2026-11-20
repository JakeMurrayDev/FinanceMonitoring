import { http, HttpResponse } from 'msw'

import type { TransactionPage } from '@/api/types'

import { mockCategories, mockTransactions, pageOf } from './data'

/**
 * Default handlers: a happy-path API. Tests override them with `server.use()`
 * for errors, empty results, or to inspect requests. These mock HTTP at the
 * network level, so the real client, query and component code all run.
 */
export const handlers = [
  http.get('*/api/categories', () => HttpResponse.json({ categories: mockCategories })),

  http.get('*/api/transactions', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25)
    return HttpResponse.json<TransactionPage>(pageOf(mockTransactions, { page, pageSize }))
  }),
]
