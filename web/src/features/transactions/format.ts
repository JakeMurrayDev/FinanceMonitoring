import type { TransactionItem } from '@/api/types'
import { formatMoney, money, type Money } from '@/lib/money'

/** Income as a positive amount, expenses as negative. The API sends both as positive. */
export function signedAmount(item: Pick<TransactionItem, 'amount' | 'currency' | 'type'>): Money {
  return money(item.type === 'Expense' ? -item.amount : item.amount, item.currency)
}

/** "+$4,850.00" or "-$16.50". The explicit sign means colour is never the only cue. */
export function formatSignedAmount(item: Pick<TransactionItem, 'amount' | 'currency' | 'type'>) {
  return formatMoney(signedAmount(item), { signDisplay: 'always' })
}
