import type { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'

import { RouteError } from '@/components/layout/RouteError'
import { parseSearch, stringifySearch } from '@/lib/search-params'
import { routeTree } from '@/routeTree.gen'

/**
 * @param history Defaults to the browser's URL. Tests pass a memory history
 * so they can start at any URL (e.g. "/transactions?category=food").
 */
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    ...(history && { history }),
    // Available in every route's loader/beforeLoad as `context.queryClient`,
    // so later phases can prefetch data before a page renders.
    context: { queryClient },
    defaultPreload: 'intent',
    defaultErrorComponent: RouteError,
    scrollRestoration: true,
    parseSearch,
    stringifySearch,
  })
}

// Registers the router type globally so <Link to="..."> and search params are type-checked.
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
