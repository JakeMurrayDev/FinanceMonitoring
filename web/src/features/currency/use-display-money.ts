import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { RateInfo } from '@/api/types'
import { convert, formatMoney, money, type FormatMoneyOptions, type Money } from '@/lib/money'

import { ACCOUNT_CURRENCY, useDisplayCurrency } from './display-currency'
import { rateQueryOptions } from './queries'

export interface DisplayMoney {
  /** The currency the user picked. */
  requested: string
  /** The rate in use, or null while amounts are shown in USD. */
  rate: RateInfo | null
  /** The picked currency's rate couldn't be loaded, so amounts are in USD. */
  ratesDown: boolean
  /** An amount stored in USD minor units, in the display currency. */
  toDisplay: (usdMinor: number) => Money
  /** The same, formatted: "€4,412.29". */
  format: (usdMinor: number, options?: FormatMoneyOptions) => string
}

/**
 * Converts amounts for display only. Pages keep their data in USD, the
 * currency it's stored and edited in, so optimistic updates and editors never
 * mix currencies. `convert` does exact decimal maths with one half-even
 * rounding, the same as the server does for the dashboard.
 */
export function useDisplayMoney(): DisplayMoney {
  const [requested] = useDisplayCurrency()
  const needsRate = requested !== ACCOUNT_CURRENCY
  const query = useQuery({
    ...rateQueryOptions(requested),
    enabled: needsRate,
    // Switching EUR → GBP keeps showing EUR (labelled as EUR) until GBP arrives.
    placeholderData: keepPreviousData,
  })

  const rate = needsRate && !query.isError ? (query.data ?? null) : null

  const toDisplay = useCallback(
    (usdMinor: number) => {
      const usd = money(usdMinor, ACCOUNT_CURRENCY)
      return rate ? convert(usd, rate.rate, rate.quote) : usd
    },
    [rate],
  )
  const format = useCallback(
    (usdMinor: number, options?: FormatMoneyOptions) => formatMoney(toDisplay(usdMinor), options),
    [toDisplay],
  )

  return { requested, rate, ratesDown: needsRate && query.isError, toDisplay, format }
}
