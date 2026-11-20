/**
 * Low-level exact decimal helpers built on BigInt. Nothing in here touches
 * floating-point arithmetic.
 */

/** A decimal number represented exactly as `coefficient × 10^-scale`. */
export interface ExactDecimal {
  coefficient: bigint
  scale: number
}

export function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent)
}

/**
 * Divide two BigInts and round the result to the nearest integer, breaking
 * exact .5 ties towards the even neighbour ("banker's rounding").
 *
 * Why half-even: rounding every .5 up adds a small upward bias that grows
 * when you sum many rounded values (e.g. converting hundreds of transactions).
 * Half-even rounds ties up half the time and down half the time, so the bias
 * cancels out. It is the default in IEEE 754 and common in finance.
 */
export function divideRoundHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('Division by zero')

  // Normalise so the denominator is positive; the sign lives on the numerator.
  if (denominator < 0n) {
    numerator = -numerator
    denominator = -denominator
  }

  const negative = numerator < 0n
  const absNumerator = negative ? -numerator : numerator

  const quotient = absNumerator / denominator // BigInt division truncates
  const remainder = absNumerator % denominator
  const twiceRemainder = remainder * 2n

  let rounded = quotient
  if (twiceRemainder > denominator) {
    rounded += 1n // more than half-way: round away from zero
  } else if (twiceRemainder === denominator && quotient % 2n === 1n) {
    rounded += 1n // exactly half-way and odd: round to the even neighbour
  }

  return negative ? -rounded : rounded
}

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i

/**
 * Parse a positive decimal written as a string or number into an exact
 * coefficient/scale pair. Accepts exponent notation because
 * `String(0.0000001)` is `"1e-7"`.
 *
 * A JS number's shortest string form round-trips to the same double, so
 * `parseExactDecimal(0.92345)` gives exactly 92345 × 10^-5, the value the
 * API sent, rather than the slightly-off binary approximation.
 */
export function parseExactDecimal(value: number | string): ExactDecimal | null {
  const match = DECIMAL_PATTERN.exec(String(value).trim())
  if (!match) return null

  const [, whole = '', fraction = '', exponent = '0'] = match
  let coefficient = BigInt(whole + fraction)
  let scale = fraction.length - Number(exponent)

  if (scale < 0) {
    coefficient *= pow10(-scale)
    scale = 0
  }

  return { coefficient, scale }
}
