import { useCallback } from 'react'

import type { TransactionItem } from '@/api/types'
import { ACCOUNT_CURRENCY } from '@/features/currency/display-currency'
import { useDisplayMoney } from '@/features/currency/use-display-money'
import { formatMoney, money, type Money } from '@/lib/money'

type Amounted = Pick<TransactionItem, 'amount' | 'currency' | 'type'>

/** Income as a positive amount, expenses as negative. The API sends both as positive. */
export function signedAmount(item: Amounted): Money {
  return money(item.type === 'Expense' ? -item.amount : item.amount, item.currency)
}

/** "+$4,850.00" or "-$16.50". The explicit sign means colour is never the only cue. */
export function formatSignedAmount(item: Amounted) {
  return formatMoney(signedAmount(item), { signDisplay: 'always' })
}

/**
 * `formatSignedAmount` in the display currency picked in the header. The
 * conversion is monotonic, so the API's sort by USD amount stays correct.
 */
export function useFormatSignedAmount() {
  const { toDisplay } = useDisplayMoney()
  return useCallback(
    (item: Amounted) => {
      const signed = signedAmount(item)
      // Every transaction is in USD today; anything else would show as recorded.
      const shown = signed.currency === ACCOUNT_CURRENCY ? toDisplay(signed.amount) : signed
      return formatMoney(shown, { signDisplay: 'always' })
    },
    [toDisplay],
  )
}

/** For places that render a component rather than call a hook, like table cells. */
export function SignedAmount({ item }: { item: Amounted }) {
  return useFormatSignedAmount()(item)
}
