import { QueryClient } from '@tanstack/react-query'

/**
 * One factory for the app and for tests, so both use the same defaults.
 * Tests call it fresh per test to avoid cache leaking between them.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Financial data changes rarely while the tab is open; avoid refetch storms.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
