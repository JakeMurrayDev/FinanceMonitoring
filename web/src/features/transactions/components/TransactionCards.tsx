import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import type { TransactionItem } from '@/api/types'
import { NativeSelect } from '@/components/form/NativeSelect'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { formatIsoDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

import { formatSignedAmount } from '../format'
import type { TransactionSearch } from '../search-schema'
import { RowActions } from './RowActions'
import { TypeLabel, type PendingRow } from './TransactionsTable'

const SORT_OPTIONS = [
  { value: 'Date:Desc', label: 'Newest first' },
  { value: 'Date:Asc', label: 'Oldest first' },
  { value: 'Amount:Desc', label: 'Amount, high to low' },
  { value: 'Amount:Asc', label: 'Amount, low to high' },
  { value: 'Description:Asc', label: 'Description, A–Z' },
  { value: 'Category:Asc', label: 'Category, A–Z' },
] as const

interface TransactionCardsProps {
  items: readonly TransactionItem[]
  pendingRows: readonly PendingRow[]
  search: TransactionSearch
  isStale: boolean
  emptyState?: ReactNode
  onSortChange: (sort: TransactionSearch['sort'], dir: TransactionSearch['dir']) => void
}

/**
 * Phone layout: one card per transaction, with the amount always in view
 * (a table would push it off-screen). Sorting moves into a select because
 * there are no column headers to click.
 */
export function TransactionCards({
  items,
  pendingRows,
  search,
  isStale,
  emptyState,
  onSortChange,
}: TransactionCardsProps) {
  const current = `${search.sort}:${search.dir}`
  const options = SORT_OPTIONS.some((o) => o.value === current)
    ? SORT_OPTIONS
    : [
        ...SORT_OPTIONS,
        {
          value: current,
          label: `${search.sort}, ${search.dir === 'Asc' ? 'ascending' : 'descending'}`,
        },
      ]

  return (
    // grid-cols-1 is minmax(0, 1fr): without it the column grows to fit the
    // longest unwrapped description and pushes amounts off narrow screens.
    <div className="grid grid-cols-1 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="mobile-sort">Sort by</Label>
        <NativeSelect
          id="mobile-sort"
          value={current}
          onChange={(event) => {
            const [sort, dir] = event.target.value.split(':') as [
              TransactionSearch['sort'],
              TransactionSearch['dir'],
            ]
            onSortChange(sort, dir)
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {items.length === 0 && pendingRows.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">{emptyState}</div>
      ) : (
        <ul
          aria-label="Transactions"
          aria-busy={isStale || undefined}
          className={cn('grid grid-cols-1 gap-2 transition-opacity', isStale && 'opacity-60')}
        >
          {pendingRows.map((row) => (
            <li
              key={row.key}
              aria-busy="true"
              className="rounded-lg border bg-muted/50 p-3 text-muted-foreground"
            >
              <Card
                description={row.description}
                meta={`${formatIsoDate(row.date)} · ${row.categoryName}`}
                amount={formatSignedAmount({ ...row, currency: 'USD' })}
                type={row.type}
                action={
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                    Saving…
                  </span>
                }
              />
            </li>
          ))}
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <Card
                description={item.description}
                meta={
                  <>
                    {formatIsoDate(item.date)} ·{' '}
                    <Badge variant="secondary">{item.categoryName}</Badge>
                  </>
                }
                amount={formatSignedAmount(item)}
                type={item.type}
                action={<RowActions item={item} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Card({
  description,
  meta,
  amount,
  type,
  action,
}: {
  description: string
  meta: ReactNode
  amount: string
  type: TransactionItem['type']
  action: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{description}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {meta}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            'font-mono whitespace-nowrap tabular-nums',
            type === 'Income' ? 'text-income' : 'text-expense',
          )}
        >
          {amount}
        </p>
        <TypeLabel type={type} />
      </div>
      <div className="-mt-1 -mr-1">{action}</div>
    </div>
  )
}
