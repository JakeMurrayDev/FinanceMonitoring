import { Info } from 'lucide-react'

/**
 * Shown on the public demo (VITE_DEMO_MODE=true). The demo API keeps its
 * data in Lambda's temporary storage, so it resets to fresh sample data from
 * time to time. Better to say so up front than to surprise anyone.
 */
export function DemoBanner({
  enabled = import.meta.env.VITE_DEMO_MODE === 'true',
}: {
  enabled?: boolean
}) {
  if (!enabled) return null
  return (
    <div className="border-b bg-muted text-muted-foreground">
      <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm">
        <Info aria-hidden="true" className="size-4 shrink-0" />
        Demo with sample data. Feel free to add, edit and delete: everything resets to fresh sample
        data from time to time.
      </p>
    </div>
  )
}
