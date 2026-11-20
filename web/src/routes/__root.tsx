import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: 'Finance Monitor' }] }),
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      {/* Applies each route's `head()` — gives every page a unique <title> for screen readers. */}
      <HeadContent />
      <AppShell>
        <Outlet />
      </AppShell>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" description="That page doesn't exist." />
      <Link to="/" className="underline underline-offset-4">
        Back to dashboard
      </Link>
    </>
  )
}
