import { describe, expect, it } from 'vitest'

import { assertCurrencyCode, minorUnits } from './currency'
import { MoneyError } from './errors'

describe('minorUnits', () => {
  it.each([
    ['USD', 2],
    ['EUR', 2],
    ['GBP', 2],
    ['JPY', 0], // yen has no minor unit
    ['KRW', 0],
    ['KWD', 3], // Kuwaiti dinar: 1000 fils
    ['BHD', 3],
  ])('%s has %i decimal places', (currency, digits) => {
    expect(minorUnits(currency)).toBe(digits)
  })

  it.each(['usd', 'US', 'USDD', 'U$D', ''])('rejects malformed code %j', (code) => {
    expect(() => minorUnits(code)).toThrow(MoneyError)
    expect(() => {
      assertCurrencyCode(code)
    }).toThrow(/invalid currency code/i)
  })
})
