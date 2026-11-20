import { describe, expect, it } from 'vitest'

import { divideRoundHalfEven, parseExactDecimal } from './decimal'

describe('divideRoundHalfEven', () => {
  it.each([
    // [numerator, denominator, expected, why]
    [6n, 3n, 2n, 'exact division'],
    [0n, 5n, 0n, 'zero'],
    [9n, 4n, 2n, '2.25 rounds down'],
    [11n, 4n, 3n, '2.75 rounds up'],
    [5n, 2n, 2n, '2.5 ties to even (down)'],
    [7n, 2n, 4n, '3.5 ties to even (up)'],
    [10n, 4n, 2n, '2.5 ties to even (down)'],
    [-5n, 2n, -2n, '-2.5 ties to even, symmetric with positive'],
    [-7n, 2n, -4n, '-3.5 ties to even, symmetric with positive'],
    [-11n, 4n, -3n, '-2.75 rounds away from zero'],
    [5n, -2n, -2n, 'negative denominator'],
  ])('%i / %i = %i (%s)', (numerator, denominator, expected) => {
    expect(divideRoundHalfEven(numerator, denominator)).toBe(expected)
  })

  it('spreads ties evenly instead of always rounding up', () => {
    // 0.5, 1.5, 2.5, 3.5 → 0, 2, 2, 4. Sum 8 equals the exact sum 8.
    // Round-half-up would give 1, 2, 3, 4 = 10: a bias of +2.
    const ties = [1n, 3n, 5n, 7n].map((n) => divideRoundHalfEven(n, 2n))
    expect(ties).toEqual([0n, 2n, 2n, 4n])
  })

  it('throws on division by zero', () => {
    expect(() => divideRoundHalfEven(1n, 0n)).toThrow(RangeError)
  })
})

describe('parseExactDecimal', () => {
  it.each([
    ['0.92345', 92345n, 5],
    ['157.82', 15782n, 2],
    ['2', 2n, 0],
    ['1.5e2', 150n, 0],
    ['1e-7', 1n, 7],
  ])('parses %s exactly', (input, coefficient, scale) => {
    expect(parseExactDecimal(input)).toEqual({ coefficient, scale })
  })

  it('reads a JS number as its shortest decimal form, not its binary approximation', () => {
    // 0.92345 is stored as 0.92344999999999999307... but String() gives "0.92345".
    expect(parseExactDecimal(0.92345)).toEqual({ coefficient: 92345n, scale: 5 })
    expect(parseExactDecimal(0.0000001)).toEqual({ coefficient: 1n, scale: 7 })
    expect(parseExactDecimal(1e21)).toEqual({ coefficient: 10n ** 21n, scale: 0 })
  })

  it.each(['', 'abc', '-1', '1.2.3', '1,000', 'NaN', 'Infinity'])('rejects %j', (input) => {
    expect(parseExactDecimal(input)).toBeNull()
  })
})
