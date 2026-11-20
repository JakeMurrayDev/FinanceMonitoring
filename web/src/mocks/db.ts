import type { TransactionItem } from '@/api/types'

import { mockCategories, mockTransactions } from './data'

/**
 * A tiny in-memory stand-in for the API's database, so tests can assert on
 * the state after a mutation and refetch, not just the optimistic moment.
 * Reset between tests in test/setup.ts.
 */
let rows: TransactionItem[] = []
let nextId = 100

export const db = {
  reset() {
    rows = structuredClone(mockTransactions)
    nextId = 100
  },
  all: () => rows,
  find: (id: string) => rows.find((row) => row.id === id),
  insert(input: Omit<TransactionItem, 'id' | 'categoryName' | 'version'>): TransactionItem {
    const row: TransactionItem = {
      ...input,
      id: `01935a3c-0000-7000-8000-${String(nextId++).padStart(12, '0')}`,
      categoryName: categoryName(input.categoryId),
      version: 1,
    }
    rows = [row, ...rows]
    return row
  },
  /** Returns the updated row, 'conflict' on a stale version, or undefined if missing. */
  update(id: string, input: Omit<TransactionItem, 'id' | 'categoryName'>) {
    const existing = rows.find((row) => row.id === id)
    if (!existing) return undefined
    if (existing.version !== input.version) return 'conflict' as const
    const updated = {
      ...existing,
      ...input,
      categoryName: categoryName(input.categoryId),
      version: input.version + 1,
    }
    rows = rows.map((row) => (row.id === id ? updated : row))
    return updated
  },
  /** Returns 'deleted', 'conflict' on a stale version, or undefined if missing. */
  remove(id: string, version: number) {
    const existing = rows.find((row) => row.id === id)
    if (!existing) return undefined
    if (existing.version !== version) return 'conflict' as const
    rows = rows.filter((row) => row.id !== id)
    return 'deleted' as const
  },
}

function categoryName(id: string) {
  return mockCategories.find((c) => c.id === id)?.name ?? id
}

db.reset()
