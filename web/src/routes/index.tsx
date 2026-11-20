import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Dashboard · Finance Monitor' }] }),
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <PageHeader
      title="Dashboard"
      description="Income, expenses and spending trends — coming in Phase 5."
    />
  )
}
