import { createFileRoute } from '@tanstack/react-router'

import { NewTransactionDialog } from '@/features/transactions/components/TransactionDialogs'

// Rendered as a dialog over the transactions list (via the parent's <Outlet />),
// so Back closes it and the list keeps its filters underneath.
export const Route = createFileRoute('/transactions/new')({
  head: () => ({ meta: [{ title: 'Add transaction · Finance Monitor' }] }),
  component: NewTransactionDialog,
})
