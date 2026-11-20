import type { Dashboard } from '@/api/types'

/** November 2026 in USD, matching the shapes the API returns. Categories sum to totals.expenses. */
export function usdDashboard(month = '2026-11'): Dashboard {
  return {
    month,
    currency: 'USD',
    rate: null,
    totals: { income: 485_000, expenses: 233_796, net: 251_204 },
    previous: { income: 563_276, expenses: 265_211, net: 298_065 },
    savingsRateBasisPoints: 5179,
    byCategory: [
      { categoryId: 'rent', name: 'Rent', amount: 165_000 },
      { categoryId: 'groceries', name: 'Groceries', amount: 30_841 },
      { categoryId: 'utilities', name: 'Utilities', amount: 14_352 },
      { categoryId: 'dining', name: 'Dining Out', amount: 10_813 },
      { categoryId: 'transport', name: 'Transport', amount: 9_242 },
      { categoryId: 'subscriptions', name: 'Subscriptions', amount: 2_748 },
      { categoryId: 'health', name: 'Health', amount: 500 },
      { categoryId: 'shopping', name: 'Shopping', amount: 300 },
    ],
    trend: [
      { month: '2026-06', income: 593_909, expenses: 259_677, net: 334_232 },
      { month: '2026-07', income: 485_460, expenses: 272_340, net: 213_120 },
      { month: '2026-08', income: 556_717, expenses: 250_565, net: 306_152 },
      { month: '2026-09', income: 485_467, expenses: 327_979, net: 157_488 },
      { month: '2026-10', income: 563_276, expenses: 265_211, net: 298_065 },
      { month: '2026-11', income: 485_000, expenses: 233_796, net: 251_204 },
    ],
  }
}

/** The same month converted to EUR at 0.90975 (values as the API computes them). */
export function eurDashboard(month = '2026-11', stale = false): Dashboard {
  const usd = usdDashboard(month)
  return {
    ...usd,
    currency: 'EUR',
    rate: { base: 'USD', quote: 'EUR', rate: '0.90975', date: '2026-11-19', stale },
    totals: { income: 441_229, expenses: 212_696, net: 228_533 },
    previous: { income: 512_440, expenses: 241_276, net: 271_165 },
    byCategory: usd.byCategory.map((c) => ({ ...c, amount: Math.round(c.amount * 0.90975) })),
  }
}

export const mockCurrencies = [
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'USD', name: 'US Dollar' },
]
