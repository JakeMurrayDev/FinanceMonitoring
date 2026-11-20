import { z } from 'zod'

import type { SortDirection, TransactionSortField, TransactionType } from '@/api/types'

// `satisfies` ties these lists to the generated API types: if the C# enum
// changes, these lines stop compiling.
export const TRANSACTION_TYPES = ['Income', 'Expense'] as const satisfies readonly TransactionType[]
export const SORT_FIELDS = [
  'Date',
  'Amount',
  'Description',
  'Category',
] as const satisfies readonly TransactionSortField[]
export const SORT_DIRECTIONS = ['Asc', 'Desc'] as const satisfies readonly SortDirection[]
export const PAGE_SIZES = [10, 25, 50, 100] as const

export const SEARCH_DEFAULTS = {
  sort: 'Date',
  dir: 'Desc',
  page: 1,
  pageSize: 25,
} as const

const CATEGORY_ID = /^[a-z0-9-]{1,32}$/

/**
 * Accepts the typed value (from `navigate`) or its string form (from the URL),
 * so links stay type-checked while hand-edited URLs still parse.
 */
const integer = z.coerce.number<string | number>().int()

/**
 * The transactions page's URL contract. Every field uses `.catch()` so a bad
 * or hand-edited URL (`?page=abc&type=bogus`) degrades to defaults instead of
 * crashing the page.
 */
export const transactionSearchSchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(TRANSACTION_TYPES).optional().catch(undefined),
  category: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => [value].flat().filter((id) => CATEGORY_ID.test(id)))
    .optional()
    .catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  sort: z.enum(SORT_FIELDS).default(SEARCH_DEFAULTS.sort).catch(SEARCH_DEFAULTS.sort),
  dir: z.enum(SORT_DIRECTIONS).default(SEARCH_DEFAULTS.dir).catch(SEARCH_DEFAULTS.dir),
  page: integer.min(1).default(SEARCH_DEFAULTS.page).catch(SEARCH_DEFAULTS.page),
  pageSize: integer
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
    .default(SEARCH_DEFAULTS.pageSize)
    .catch(SEARCH_DEFAULTS.pageSize),
})

export type TransactionSearch = z.output<typeof transactionSearchSchema>

/** Filters only, i.e. everything that changes *which* rows match (not sort or paging). */
export type TransactionFilters = Pick<
  TransactionSearch,
  'search' | 'type' | 'category' | 'from' | 'to'
>

export function hasActiveFilters(search: TransactionSearch): boolean {
  const { search: text, type, category, from, to } = search
  return [text, type, from, to].some(Boolean) || (category?.length ?? 0) > 0
}

/** Returns an error message when the date range is reversed, otherwise undefined. */
export function dateRangeError(search: Pick<TransactionSearch, 'from' | 'to'>): string | undefined {
  return search.from && search.to && search.from > search.to
    ? 'The start date must be on or before the end date.'
    : undefined
}
