import { describe, expect, it } from 'vitest'

import { formatIsoDate, todayIsoDate } from './dates'

describe('formatIsoDate', () => {
  it('formats a calendar date without shifting it across time zones', () => {
    expect(formatIsoDate('2026-11-18')).toBe('Nov 18, 2026')
    expect(formatIsoDate('2026-01-01')).toBe('Jan 1, 2026')
  })
})

describe('todayIsoDate', () => {
  it('uses the local calendar date', () => {
    // 11:30pm local time on Nov 20: still the 20th locally, whatever UTC says.
    expect(todayIsoDate(new Date(2026, 10, 20, 23, 30))).toBe('2026-11-20')
    expect(todayIsoDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })
})
