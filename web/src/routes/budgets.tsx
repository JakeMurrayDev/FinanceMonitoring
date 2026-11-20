import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/budgets')({
  head: () => ({ meta: [{ title: 'Budgets · Finance Monitor' }] }),
  component: BudgetsPage,
})

function BudgetsPage() {
  return (
    <PageHeader title="Budgets" description="Monthly budgets per category — coming in Phase 4." />
  )
}
