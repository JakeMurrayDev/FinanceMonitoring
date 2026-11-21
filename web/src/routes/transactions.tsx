import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { categoriesQueryOptions } from '@/features/categories/queries'
import { prefetchDisplayRate } from '@/features/currency/queries'
import { TransactionsPage } from '@/features/transactions/components/TransactionsPage'
import { transactionsQueryOptions } from '@/features/transactions/queries'
import {
  dateRangeError,
  SEARCH_DEFAULTS,
  transactionSearchSchema,
} from '@/features/transactions/search-schema'

const ignore = () => undefined

export const Route = createFileRoute('/transactions')({
  // The URL is the single source of truth for filters, sorting and paging.
  validateSearch: transactionSearchSchema,
  // Keep URLs short: don't write ?sort=Date&dir=Desc&page=1&pageSize=25.
  search: { middlewares: [stripSearchParams(SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => {
    // Start fetching as early as possible (also on link hover via preload),
    // but don't await: the page renders its own loading and error states, so
    // errors are ignored here and surface through the page's useQuery.
    if (!dateRangeError(deps)) void queryClient.query(transactionsQueryOptions(deps)).catch(ignore)
    void queryClient.query(categoriesQueryOptions()).catch(ignore)
    prefetchDisplayRate(queryClient)
  },
  head: () => ({ meta: [{ title: 'Transactions · Finance Monitor' }] }),
  component: TransactionsPage,
})
