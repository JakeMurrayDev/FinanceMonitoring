import { describe, expect, it } from 'vitest'

import { addMonths, currentMonth, formatMonth, isMonth } from './months'

describe('months', () => {
  it('reads the local month', () => {
    expect(currentMonth(new Date(2026, 10, 30, 23, 59))).toBe('2026-11')
    expect(currentMonth(new Date(2027, 0, 1, 0, 0))).toBe('2027-01')
  })

  it.each([
    ['2026-11', 1, '2026-12'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-03', -14, '2025-01'],
    ['2026-11', 0, '2026-11'],
  ])('adds months: %s %+d → %s', (month, delta, expected) => {
    expect(addMonths(month, delta)).toBe(expected)
  })

  it('formats for display', () => {
    expect(formatMonth('2026-11')).toBe('November 2026')
    expect(formatMonth('2027-01')).toBe('January 2027')
  })

  it.each(['2026-11', '1999-01'])('accepts %s', (value) => {
    expect(isMonth(value)).toBe(true)
  })

  it.each(['2026-13', '2026-1', '0000-01', 'november', '2026-11-01'])('rejects %s', (value) => {
    expect(isMonth(value)).toBe(false)
  })
})
