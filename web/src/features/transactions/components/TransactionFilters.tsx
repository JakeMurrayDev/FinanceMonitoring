import { X } from 'lucide-react'

import type { Category } from '@/api/types'
import { NativeSelect } from '@/components/form/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  dateRangeError,
  hasActiveFilters,
  TRANSACTION_TYPES,
  type TransactionFilters as Filters,
  type TransactionSearch,
} from '../search-schema'
import { CategoryFilter } from './CategoryFilter'
import { SearchInput } from './SearchInput'

interface TransactionFiltersProps {
  search: TransactionSearch
  categories: readonly Category[] | undefined
  onSearchTextChange: (search: string | undefined) => void
  onChange: (patch: Partial<Filters>) => void
  onClear: () => void
}

export function TransactionFilters({
  search,
  categories,
  onSearchTextChange,
  onChange,
  onClear,
}: TransactionFiltersProps) {
  const rangeError = dateRangeError(search)

  return (
    <section aria-label="Filters" className="mb-6 grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <SearchInput value={search.search} onCommit={onSearchTextChange} />

        <div className="grid gap-1.5">
          <Label htmlFor="transaction-type">Type</Label>
          <NativeSelect
            id="transaction-type"
            value={search.type ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onChange({
                type: TRANSACTION_TYPES.find((type) => type === value),
              })
            }}
          >
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </NativeSelect>
        </div>

        <CategoryFilter
          categories={categories}
          selected={search.category ?? []}
          onChange={(category) => {
            onChange({ category })
          }}
        />

        <div className="grid gap-1.5">
          <Label htmlFor="transaction-from">From</Label>
          <Input
            id="transaction-from"
            type="date"
            value={search.from ?? ''}
            max={search.to}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'date-range-error' : undefined}
            onChange={(event) => {
              onChange({ from: event.target.value || undefined })
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="transaction-to">To</Label>
          <Input
            id="transaction-to"
            type="date"
            value={search.to ?? ''}
            min={search.from}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'date-range-error' : undefined}
            onChange={(event) => {
              onChange({ to: event.target.value || undefined })
            }}
          />
        </div>
      </div>

      {/* An element with role="alert" is announced as soon as it's inserted. */}
      {rangeError && (
        <p id="date-range-error" role="alert" className="text-sm text-destructive">
          {rangeError}
        </p>
      )}

      {hasActiveFilters(search) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X aria-hidden="true" />
            Clear filters
          </Button>
        </div>
      )}
    </section>
  )
}
