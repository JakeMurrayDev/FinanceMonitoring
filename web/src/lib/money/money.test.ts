import { describe, expect, it } from 'vitest'

import conversionFixture from '../../../../fixtures/money/conversion-cases.json'

import { MoneyError } from './errors'
import {
  add,
  compare,
  convert,
  formatMoney,
  money,
  negate,
  parseMoney,
  subtract,
  sum,
  toDecimalString,
  zero,
  type Money,
} from './money'

const usd = (amount: number) => money(amount, 'USD')
const MAX = Number.MAX_SAFE_INTEGER

/** Intl uses non-breaking spaces in some locales; normalise them for readable assertions. */
const plainSpaces = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('money()', () => {
  it('creates a value in minor units', () => {
    expect(usd(1234)).toEqual({ amount: 1234, currency: 'USD' })
  })

  it.each([12.5, 0.1, Number.NaN, Infinity])('rejects non-integer amount %s', (amount) => {
    expect(() => usd(amount)).toThrow(expect.objectContaining({ code: 'NOT_AN_INTEGER' }))
  })

  it('rejects amounts beyond the safe integer range', () => {
    expect(() => usd(MAX + 1)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }))
    expect(usd(MAX).amount).toBe(MAX)
  })

  it('normalises -0 to 0', () => {
    expect(Object.is(usd(-0).amount, 0)).toBe(true)
  })

  it('rejects an invalid currency', () => {
    expect(() => money(100, 'usd')).toThrow(MoneyError)
  })
})

describe('arithmetic', () => {
  it('avoids the classic 0.1 + 0.2 float error', () => {
    expect(0.1 + 0.2).not.toBe(0.3) // the bug we are avoiding
    expect(add(usd(10), usd(20))).toEqual(usd(30))
  })

  it('adds and subtracts', () => {
    expect(add(usd(1999), usd(1))).toEqual(usd(2000))
    expect(subtract(usd(500), usd(1250))).toEqual(usd(-750))
  })

  it('refuses to combine different currencies', () => {
    const eur = money(100, 'EUR')
    expect(() => add(usd(100), eur)).toThrow(expect.objectContaining({ code: 'CURRENCY_MISMATCH' }))
    expect(() => subtract(usd(100), eur)).toThrow(MoneyError)
    expect(() => compare(usd(100), eur)).toThrow(MoneyError)
  })

  it('throws instead of silently losing precision on overflow', () => {
    expect(() => add(usd(MAX), usd(1))).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }))
  })

  it('sums a list, returning zero in the given currency for an empty list', () => {
    expect(sum([usd(1050), usd(-250), usd(1)], 'USD')).toEqual(usd(801))
    expect(sum([], 'EUR')).toEqual(zero('EUR'))
  })

  it('sums a list exactly where floats drift', () => {
    const tenCents = Array.from({ length: 10 }, () => usd(10))
    expect(Array.from({ length: 10 }, () => 0.1).reduce((a, b) => a + b)).not.toBe(1)
    expect(sum(tenCents, 'USD')).toEqual(usd(100))
  })

  it('negates', () => {
    expect(negate(usd(500))).toEqual(usd(-500))
    expect(Object.is(negate(usd(0)).amount, 0)).toBe(true)
  })

  it('compares, and works as a sort comparator', () => {
    expect(compare(usd(1), usd(2))).toBe(-1)
    expect(compare(usd(2), usd(2))).toBe(0)
    expect(compare(usd(3), usd(2))).toBe(1)

    const sorted = [usd(300), usd(-50), usd(100)].sort(compare)
    expect(sorted.map((m) => m.amount)).toEqual([-50, 100, 300])
  })
})

describe('parseMoney', () => {
  it.each([
    ['12', 'USD', 1200],
    ['12.5', 'USD', 1250],
    ['12.50', 'USD', 1250],
    ['0.01', 'USD', 1],
    ['.5', 'USD', 50],
    ['1,234.56', 'USD', 123456],
    ['1,234,567.89', 'USD', 123456789],
    ['1234567.89', 'USD', 123456789],
    ['  42.00  ', 'USD', 4200],
    ['-3.20', 'USD', -320],
    ['0', 'USD', 0],
    ['1500', 'JPY', 1500],
    ['1,500', 'JPY', 1500],
    ['1.234', 'KWD', 1234],
    ['0.1', 'KWD', 100],
  ])('parses %j as %s → %i minor units', (input, currency, amount) => {
    expect(parseMoney(input, currency)).toEqual({ ok: true, value: money(amount, currency) })
  })

  it('is exact where parseFloat × 100 is not', () => {
    // A naive implementation: Math.trunc(parseFloat('4.35') * 100) === 434
    expect(Math.trunc(parseFloat('4.35') * 100)).toBe(434)
    expect(parseMoney('4.35', 'USD')).toEqual({ ok: true, value: usd(435) })
  })

  it('treats "-0" as zero', () => {
    const result = parseMoney('-0', 'USD')
    expect(result.ok && Object.is(result.value.amount, 0)).toBe(true)
  })

  it.each(['', '   '])('returns EMPTY for %j', (input) => {
    expect(parseMoney(input, 'USD')).toEqual({ ok: false, error: 'EMPTY' })
  })

  it.each([
    'abc',
    '12.',
    '.',
    '-',
    '--1',
    '1,23',
    '1,2345',
    '12,34.5',
    '1e5',
    '$12',
    '12.3.4',
    '1 000',
  ])('returns INVALID_FORMAT for %j', (input) => {
    expect(parseMoney(input, 'USD')).toEqual({ ok: false, error: 'INVALID_FORMAT' })
  })

  it.each([
    ['1.234', 'USD'],
    ['12.5', 'JPY'],
    ['0.0001', 'KWD'],
  ])('returns TOO_MANY_DECIMALS for %j in %s', (input, currency) => {
    expect(parseMoney(input, currency)).toEqual({ ok: false, error: 'TOO_MANY_DECIMALS' })
  })

  it('accepts the largest safe amount and rejects one cent more', () => {
    expect(parseMoney('90071992547409.91', 'USD')).toEqual({ ok: true, value: usd(MAX) })
    expect(parseMoney('90071992547409.92', 'USD')).toEqual({ ok: false, error: 'OUT_OF_RANGE' })
    expect(parseMoney('-90071992547409.92', 'USD')).toEqual({ ok: false, error: 'OUT_OF_RANGE' })
  })
})

describe('convert', () => {
  // The same file drives api/tests/.../ConversionParityTests.cs, so the C#
  // and TypeScript implementations are held to identical results.
  it.each(conversionFixture.cases)(
    '$name: $amount $from × $rate → $expected $to',
    ({ amount, from, rate, to, expected }) => {
      expect(convert(money(amount, from), rate, to)).toEqual(money(expected, to))
    },
  )

  it('is exact where float multiplication is not', () => {
    // 50¢ × 1.15 is exactly 57.5¢, but in floats it's 57.49999999999999,
    // so Math.round gives 57. The exact tie rounds to even: 58.
    expect(Math.round(50 * 1.15)).toBe(57)
    expect(convert(usd(50), 1.15, 'EUR')).toEqual(money(58, 'EUR'))
  })

  it('accepts the rate as a JS number, including exponent notation', () => {
    // JSON.parse gives numbers, so the Frankfurter response arrives this way.
    expect(convert(usd(1999), 0.92345, 'EUR')).toEqual(money(1846, 'EUR'))
    expect(convert(usd(5_000_000_000), 1e-7, 'EUR')).toEqual(money(500, 'EUR'))
  })

  it.each([0, -1.1, Number.NaN, Infinity, 'abc', '-1', '0'])('rejects invalid rate %j', (rate) => {
    expect(() => convert(usd(100), rate, 'EUR')).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE' }),
    )
  })

  it('throws if the converted amount overflows', () => {
    expect(() => convert(usd(MAX), 2, 'EUR')).toThrow(
      expect.objectContaining({ code: 'OUT_OF_RANGE' }),
    )
  })
})

describe('toDecimalString', () => {
  it.each<[Money, string]>([
    [usd(123456), '1234.56'],
    [usd(7), '0.07'],
    [usd(-5), '-0.05'],
    [usd(0), '0.00'],
    [usd(MAX), '90071992547409.91'],
    [money(1500, 'JPY'), '1500'],
    [money(1, 'KWD'), '0.001'],
  ])('%o → %s', (value, expected) => {
    expect(toDecimalString(value)).toBe(expected)
  })

  it('round-trips with parseMoney', () => {
    for (const value of [usd(123456), usd(-5), money(1500, 'JPY'), money(1, 'KWD')]) {
      expect(parseMoney(toDecimalString(value), value.currency)).toEqual({ ok: true, value })
    }
  })
})

describe('formatMoney', () => {
  it.each<[Money, string]>([
    [usd(123456), '$1,234.56'],
    [usd(-5), '-$0.05'],
    [usd(0), '$0.00'],
    [money(150000, 'JPY'), '¥150,000'],
    [money(1234, 'KWD'), 'KWD 1.234'],
    [usd(MAX), '$90,071,992,547,409.91'],
  ])('formats %o as %s', (value, expected) => {
    expect(plainSpaces(formatMoney(value))).toBe(expected)
  })

  it('respects the locale', () => {
    expect(plainSpaces(formatMoney(money(123456, 'EUR'), { locale: 'de-DE' }))).toBe('1.234,56 €')
    expect(formatMoney(money(123456, 'GBP'), { locale: 'en-GB' })).toBe('£1,234.56')
  })

  it('can always show the sign, for income/expense columns', () => {
    expect(formatMoney(usd(500), { signDisplay: 'always' })).toBe('+$5.00')
    expect(formatMoney(usd(-500), { signDisplay: 'always' })).toBe('-$5.00')
  })
})
