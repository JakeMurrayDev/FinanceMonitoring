import {
  createColumnHelper,
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type ReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpDown, ArrowUpRight } from 'lucide-react'

import type { TransactionItem, TransactionPage } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatIsoDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

import { formatSignedAmount } from '../format'
import { SORT_FIELDS, type TransactionSearch } from '../search-schema'
import { TablePagination } from './TablePagination'

// Module scope: features and columns must be stable across renders.
const features = tableFeatures({ rowSortingFeature, rowPaginationFeature })
const helper = createColumnHelper<typeof features, TransactionItem>()

// Column ids match the API's sort fields, so table sorting maps straight onto the URL.
const columns = helper.columns([
  helper.accessor('date', {
    id: 'Date',
    header: 'Date',
    sortDescFirst: true,
    cell: (info) => <span className="whitespace-nowrap">{formatIsoDate(info.getValue())}</span>,
  }),
  helper.accessor('description', {
    id: 'Description',
    header: 'Description',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  helper.accessor('categoryName', {
    id: 'Category',
    header: 'Category',
    cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
  }),
  helper.accessor('type', {
    id: 'type',
    header: 'Type',
    enableSorting: false,
    cell: (info) => <TypeLabel type={info.getValue()} />,
  }),
  helper.accessor('amount', {
    id: 'Amount',
    header: 'Amount',
    sortDescFirst: true,
    cell: (info) => (
      <span
        className={cn(
          'font-mono whitespace-nowrap tabular-nums',
          info.row.original.type === 'Income' ? 'text-income' : 'text-expense',
        )}
      >
        {formatSignedAmount(info.row.original)}
      </span>
    ),
  }),
])

const EMPTY_ROWS: TransactionItem[] = []

/** Numeric columns are right-aligned so digits line up. */
const RIGHT_ALIGNED = new Set(['Amount'])

interface TransactionsTableProps {
  page: TransactionPage | undefined
  search: TransactionSearch
  /** True while showing the previous page's rows during a fetch. */
  isStale: boolean
  onSortChange: (sort: TransactionSearch['sort'], dir: TransactionSearch['dir']) => void
  onPaginationChange: (page: number, pageSize: number) => void
  /** Rendered in place of rows when the table has nothing to show. */
  emptyState?: React.ReactNode
}

export function TransactionsTable({
  page,
  search,
  isStale,
  onSortChange,
  onPaginationChange,
  emptyState,
}: TransactionsTableProps) {
  const sorting: SortingState = [{ id: search.sort, desc: search.dir === 'Desc' }]
  const pagination: PaginationState = { pageIndex: search.page - 1, pageSize: search.pageSize }

  const table = useTable({
    features,
    columns,
    data: page?.items ?? EMPTY_ROWS,
    getRowId: (row) => row.id,
    rowCount: page?.totalCount ?? 0,
    // The server already filtered, sorted and paged these rows; Table just renders them.
    manualSorting: true,
    manualPagination: true,
    autoResetPageIndex: false,
    enableSortingRemoval: false,
    enableMultiSort: false,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      const [next] = functionalUpdate(updater, sorting)
      const sort = SORT_FIELDS.find((field) => field === next?.id)
      if (sort) onSortChange(sort, next?.desc ? 'Desc' : 'Asc')
    },
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, pagination)
      onPaginationChange(next.pageIndex + 1, next.pageSize)
    },
  })

  const rows = table.getRowModel().rows

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-busy={isStale || undefined}>
          <TableCaption className="sr-only">
            Transactions, sorted by {search.sort.toLowerCase()}{' '}
            {search.dir === 'Asc' ? 'ascending' : 'descending'}
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const { column } = header
                  const sorted = column.getIsSorted()
                  const alignRight = RIGHT_ALIGNED.has(column.id)
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        column.getCanSort()
                          ? sorted === 'asc'
                            ? 'ascending'
                            : sorted === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                      className={cn(alignRight && 'text-right')}
                    >
                      {column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          className={cn(
                            '-mx-2 inline-flex items-center gap-1 rounded px-2 py-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                            alignRight && 'flex-row-reverse',
                          )}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon sorted={sorted} />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn('transition-opacity', isStale && 'opacity-60')}>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(RIGHT_ALIGNED.has(cell.column.id) && 'text-right')}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {page && page.totalCount > 0 && (
        <TablePagination table={table} totalCount={page.totalCount} />
      )}
    </div>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return <Icon aria-hidden="true" className={cn('size-3.5', !sorted && 'opacity-40')} />
}

function TypeLabel({ type }: { type: TransactionItem['type'] }) {
  // Icon + word, not colour alone, distinguishes income from expense.
  const Icon = type === 'Income' ? ArrowDownLeft : ArrowUpRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm',
        type === 'Income' ? 'text-income' : 'text-expense',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {type}
    </span>
  )
}

export type TransactionsTableInstance = ReactTable<typeof features, TransactionItem>
