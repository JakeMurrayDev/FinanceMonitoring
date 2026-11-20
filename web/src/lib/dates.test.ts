import { describe, expect, it } from 'vitest'

import { formatIsoDate } from './dates'

describe('formatIsoDate', () => {
  it('formats a calendar date without shifting it across time zones', () => {
    expect(formatIsoDate('2026-11-18')).toBe('Nov 18, 2026')
    expect(formatIsoDate('2026-01-01')).toBe('Jan 1, 2026')
  })
})
