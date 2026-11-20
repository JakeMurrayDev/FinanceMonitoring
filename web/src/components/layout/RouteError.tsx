import type { ErrorComponentProps } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

/** Fallback for any error thrown while rendering or loading a route. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 p-6">
      <h2 className="font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : 'An unexpected error occurred.'}
      </p>
      <Button variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
