import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createAppRouter } from '@/app/router'

/**
 * Render the whole app (real routes, real providers) at a URL, with a fresh
 * query cache and in-memory history. Returns the router so tests can assert
 * on the URL after interactions.
 */
export function renderApp(url: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [url] }))
  const user = userEvent.setup()

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...result, router, user, queryClient }
}

/** Current location as a URLSearchParams, for asserting on the URL. */
export function currentSearch(router: ReturnType<typeof renderApp>['router']) {
  return new URLSearchParams(router.state.location.searchStr)
}
