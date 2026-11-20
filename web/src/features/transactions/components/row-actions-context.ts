import { createContext } from 'react'

import type { TransactionItem } from '@/api/types'

/**
 * Lets the module-scope column definitions reach page-level handlers without
 * recreating the columns on every render.
 */
export const RowActionsContext = createContext<{ onDelete: (item: TransactionItem) => void }>({
  onDelete: () => undefined,
})
