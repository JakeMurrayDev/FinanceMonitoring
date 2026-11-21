import { Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import type { RateInfo } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatIsoDate } from '@/lib/dates'

import { ACCOUNT_CURRENCY } from '../display-currency'
import { useDisplayMoney } from '../use-display-money'

/**
 * States exactly how amounts were converted, and warns when the rate is out
 * of date. `note` adds what the conversion means on this page.
 */
export function RateNotice({ rate, note }: { rate: RateInfo; note?: ReactNode }) {
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
        Converted from {rate.base} at {conversion}.{note && <> {note}</>}
      </span>
    </p>
  )
}

export function RatesUnavailableAlert({ requested }: { requested: string }) {
  return (
    <Alert>
      <TriangleAlert aria-hidden="true" className="text-warning" />
      <AlertTitle>Exchange rates are unavailable right now</AlertTitle>
      <AlertDescription>
        Showing amounts in {ACCOUNT_CURRENCY} instead. Try {requested} again later.
      </AlertDescription>
    </Alert>
  )
}

/** For pages that convert in the browser: the rate in use, or why there isn't one. */
export function DisplayCurrencyNotice({ note }: { note: ReactNode }) {
  const { rate, ratesDown, requested } = useDisplayMoney()
  if (ratesDown) return <RatesUnavailableAlert requested={requested} />
  return rate ? <RateNotice rate={rate} note={note} /> : null
}
