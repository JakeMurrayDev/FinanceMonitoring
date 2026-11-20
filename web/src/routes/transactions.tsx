import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/transactions')({
  head: () => ({ meta: [{ title: 'Transactions · Finance Monitor' }] }),
  component: TransactionsPage,
})

function TransactionsPage() {
  return (
    <PageHeader
      title="Transactions"
      description="Searchable, filterable transaction history — coming in Phase 2."
    />
  )
}
