import { Info, TriangleAlert } from 'lucide-react'

import type { RateInfo } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatIsoDate } from '@/lib/dates'

/** States exactly how amounts were converted, and warns when the rate is out of date. */
export function RateNotice({ rate }: { rate: RateInfo }) {
  const conversion = `1 ${rate.base} = ${rate.rate} ${rate.quote} (ECB reference rate, ${formatIsoDate(rate.date)})`

  if (rate.stale) {
    return (
      <Alert>
        <TriangleAlert aria-hidden="true" className="text-warning" />
        <AlertTitle>Exchange rates couldn’t be refreshed</AlertTitle>
        <AlertDescription>
          Showing amounts at the last available rate: {conversion}.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <p className="flex gap-2 text-sm text-muted-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        Converted from {rate.base} at {conversion}. Each figure is converted separately from its
        exact {rate.base} value, so categories may not add up to the total to the cent.
      </span>
    </p>
  )
}
