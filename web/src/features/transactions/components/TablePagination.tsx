import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { NativeSelect } from '@/components/form/NativeSelect'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

import { PAGE_SIZES } from '../search-schema'
import type { TransactionsTableInstance } from './TransactionsTable'

interface TablePaginationProps {
  table: TransactionsTableInstance
  totalCount: number
}

export function TablePagination({ table, totalCount }: TablePaginationProps) {
  const { pageIndex, pageSize } = table.state.pagination
  const pageCount = Math.max(table.getPageCount(), 1)
  const first = Math.min(pageIndex * pageSize + 1, totalCount)
  const last = Math.min((pageIndex + 1) * pageSize, totalCount)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row"
    >
      {/* Announced to screen readers whenever the visible range changes. */}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Showing {first.toLocaleString('en-US')}–{last.toLocaleString('en-US')} of{' '}
        {totalCount.toLocaleString('en-US')} transactions
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="page-size" className="font-normal whitespace-nowrap">
            Rows per page
          </Label>
          <NativeSelect
            id="page-size"
            className="w-20"
            value={pageSize}
            onChange={(event) => {
              table.setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </div>

        <span className="text-sm whitespace-nowrap">
          Page {pageIndex + 1} of {pageCount}
        </span>

        <div className="flex items-center gap-1">
          <PageButton
            label="First page"
            disabled={!table.getCanPreviousPage()}
            onClick={table.firstPage}
          >
            <ChevronsLeft />
          </PageButton>
          <PageButton
            label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={table.previousPage}
          >
            <ChevronLeft />
          </PageButton>
          <PageButton label="Next page" disabled={!table.getCanNextPage()} onClick={table.nextPage}>
            <ChevronRight />
          </PageButton>
          <PageButton label="Last page" disabled={!table.getCanNextPage()} onClick={table.lastPage}>
            <ChevronsRight />
          </PageButton>
        </div>
      </div>
    </nav>
  )
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onClick()
      }}
    >
      {children}
    </Button>
  )
}
