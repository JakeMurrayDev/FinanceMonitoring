import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Outlet } from '@tanstack/react-router'
import { AlertCircle, Plus, RotateCw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import type { TransactionItem } from '@/api/types'

import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { categoriesQueryOptions } from '@/features/categories/queries'
import { DisplayCurrencyNotice } from '@/features/currency/components/RateNotice'

import { useDeleteTransaction, usePendingCreates } from '../mutations'
import { transactionsQueryOptions } from '../queries'
import {
  dateRangeError,
  hasActiveFilters,
  type TransactionFilters as Filters,
  type TransactionSearch,
} from '../search-schema'
import { DeleteTransactionDialog } from './DeleteTransactionDialog'
import { RowActionsContext } from './row-actions-context'
import { TransactionFilters } from './TransactionFilters'
import { TransactionsTable, type PendingRow } from './TransactionsTable'

// getRouteApi gives typed access to the route's search params without
// importing the route file (which would create a circular import).
const route = getRouteApi('/transactions')

export function TransactionsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const rangeError = dateRangeError(search)
  const transactions = useQuery({
    ...transactionsQueryOptions(search),
    enabled: !rangeError,
    // Keep showing the current rows while the next page/sort/filter loads,
    // instead of flashing a skeleton on every click.
    placeholderData: keepPreviousData,
  })
  const categories = useQuery(categoriesQueryOptions())
  const deleteTransaction = useDeleteTransaction()
  const [toDelete, setToDelete] = useState<TransactionItem | null>(null)
  const rowActions = useMemo(() => ({ onDelete: setToDelete }), [])

  const pendingCreates = usePendingCreates()
  const pendingRows: PendingRow[] = pendingCreates.map((values, index) => ({
    ...values,
    key: `pending-${String(index)}`,
    categoryName: categories.data?.find((c) => c.id === values.categoryId)?.name ?? '…',
  }))

  const updateSearch = useCallback(
    (patch: Partial<TransactionSearch>, options: { replace?: boolean } = {}) => {
      void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: options.replace })
    },
    [navigate],
  )

  // Any filter change goes back to page 1; page 4 of the old results is meaningless.
  const updateFilters = useCallback(
    (patch: Partial<Filters>, options?: { replace?: boolean }) => {
      updateSearch({ ...patch, page: 1 }, options)
    },
    [updateSearch],
  )

  // Typing replaces the history entry, so Back doesn't step through every keystroke.
  const updateSearchText = useCallback(
    (text: string | undefined) => {
      updateFilters({ search: text }, { replace: true })
    },
    [updateFilters],
  )

  const clearFilters = () => {
    void navigate({
      search: (prev) => ({ sort: prev.sort, dir: prev.dir, pageSize: prev.pageSize }),
    })
  }

  const filtersActive = hasActiveFilters(search)

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search, filter and sort your transaction history."
        actions={
          <Button asChild>
            <Link to="/transactions/new" search={true}>
              <Plus aria-hidden="true" />
              Add transaction
            </Link>
          </Button>
        }
      />

      <TransactionFilters
        search={search}
        categories={categories.data}
        onSearchTextChange={updateSearchText}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      <div className="mb-4 empty:hidden">
        <DisplayCurrencyNotice note="Transactions are recorded in USD, so new ones are entered in USD." />
      </div>

      {rangeError ? null : transactions.isPending ? (
        <TableSkeleton />
      ) : transactions.isError && !transactions.data ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Couldn’t load transactions</AlertTitle>
          <AlertDescription>
            <p>{transactions.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void transactions.refetch()}
            >
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <RowActionsContext value={rowActions}>
          <TransactionsTable
            page={transactions.data}
            pendingRows={pendingRows}
            search={search}
            isStale={transactions.isPlaceholderData}
            onSortChange={(sort, dir) => {
              updateSearch({ sort, dir, page: 1 })
            }}
            onPaginationChange={(page, pageSize) => {
              updateSearch({ page, pageSize })
            }}
            emptyState={
              <EmptyState
                filtersActive={filtersActive}
                beyondLastPage={transactions.data.totalCount > 0}
                onClearFilters={clearFilters}
                onFirstPage={() => {
                  updateSearch({ page: 1 })
                }}
              />
            }
          />
        </RowActionsContext>
      )}

      <DeleteTransactionDialog
        transaction={toDelete}
        onCancel={() => {
          setToDelete(null)
        }}
        onConfirm={(transaction) => {
          deleteTransaction.mutate(transaction)
          setToDelete(null)
        }}
      />

      {/* Add/edit dialogs render here, over the list. */}
      <Outlet />
    </>
  )
}

function EmptyState({
  filtersActive,
  beyondLastPage,
  onClearFilters,
  onFirstPage,
}: {
  filtersActive: boolean
  beyondLastPage: boolean
  onClearFilters: () => void
  onFirstPage: () => void
}) {
  if (beyondLastPage) {
    return (
      <div className="grid justify-items-center gap-2">
        <p className="font-medium">There’s nothing on this page.</p>
        <Button variant="outline" size="sm" onClick={onFirstPage}>
          Go to the first page
        </Button>
      </div>
    )
  }

  return filtersActive ? (
    <div className="grid justify-items-center gap-2">
      <p className="font-medium">No transactions match your filters.</p>
      <Button variant="outline" size="sm" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  ) : (
    <p className="font-medium">No transactions yet.</p>
  )
}

function TableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading transactions"
      className="grid gap-2 rounded-lg border p-4"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}
