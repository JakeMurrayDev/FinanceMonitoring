import { minorUnits, type CurrencyCode } from './currency'
import { divideRoundHalfEven, parseExactDecimal, pow10 } from './decimal'
import { MoneyError } from './errors'

/**
 * An amount of money in integer **minor units** (cents for USD, yen for JPY,
 * fils for KWD) together with its currency.
 *
 * Pairing the amount with its currency means `add(usd, eur)` throws instead of
 * silently producing a meaningless number.
 */
export interface Money {
  readonly amount: number
  readonly currency: CurrencyCode
}

// ---------------------------------------------------------------------------
// Construction & validation
// ---------------------------------------------------------------------------

function assertSafeMinorUnits(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new MoneyError(
      'NOT_AN_INTEGER',
      `Money amounts must be integer minor units, got ${amount}`,
    )
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError('OUT_OF_RANGE', `Amount ${amount} exceeds the safe integer range`)
  }
}

/** Create a Money value. Throws if `amount` is not a safe integer or the currency is unknown. */
export function money(amount: number, currency: CurrencyCode): Money {
  assertSafeMinorUnits(amount)
  minorUnits(currency) // validates the currency code
  // `+ 0` turns -0 into 0 so that equality checks and formatting behave.
  return { amount: amount + 0, currency }
}

export function zero(currency: CurrencyCode): Money {
  return money(0, currency)
}

function fromBigInt(amount: bigint, currency: CurrencyCode): Money {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError('OUT_OF_RANGE', `Amount ${amount} exceeds the safe integer range`)
  }
  return money(Number(amount), currency)
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      'CURRENCY_MISMATCH',
      `Cannot combine ${a.currency} with ${b.currency}; convert first`,
    )
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount - b.amount, a.currency)
}

/**
 * Sum a list of amounts. The currency is required so that an empty list
 * still returns a meaningful zero.
 */
export function sum(values: readonly Money[], currency: CurrencyCode): Money {
  return values.reduce(add, zero(currency))
}

export function negate(value: Money): Money {
  return money(-value.amount, value.currency)
}

/** Returns -1, 0 or 1. Handy as an `Array.prototype.sort` comparator. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b)
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0
}

// ---------------------------------------------------------------------------
// Currency conversion
// ---------------------------------------------------------------------------

/**
 * Convert to another currency, where `rate` is how many units of `to` one
 * unit of `value.currency` buys (the shape the Frankfurter API returns:
 * `{ base: "USD", rates: { EUR: 0.92345 } }`).
 *
 * The rate is read as an exact decimal and all maths is done with BigInt, so
 * the only rounding is a single half-even round to the target's minor unit.
 * Doing `cents * rate` with floats would introduce error before rounding.
 */
export function convert(value: Money, rate: number | string, to: CurrencyCode): Money {
  if (typeof rate === 'number' && (!Number.isFinite(rate) || rate <= 0)) {
    throw new MoneyError('INVALID_RATE', `Exchange rate must be a positive number, got ${rate}`)
  }
  const exactRate = parseExactDecimal(rate)
  if (!exactRate || exactRate.coefficient === 0n) {
    throw new MoneyError('INVALID_RATE', `Exchange rate must be a positive number, got ${rate}`)
  }

  // result = amount × rate × 10^(toDigits − fromDigits)
  //        = amount × coefficient × 10^(toDigits − fromDigits − rateScale)
  const exponent = minorUnits(to) - minorUnits(value.currency) - exactRate.scale
  const scaled = BigInt(value.amount) * exactRate.coefficient

  const result =
    exponent >= 0 ? scaled * pow10(exponent) : divideRoundHalfEven(scaled, pow10(-exponent))

  return fromBigInt(result, to)
}

// ---------------------------------------------------------------------------
// Parsing user input
// ---------------------------------------------------------------------------

export type ParseMoneyError = 'EMPTY' | 'INVALID_FORMAT' | 'TOO_MANY_DECIMALS' | 'OUT_OF_RANGE'

export type ParseMoneyResult = { ok: true; value: Money } | { ok: false; error: ParseMoneyError }

/**
 * Optional minus, then either comma-grouped digits ("1,234") or plain digits
 * ("1234"), then an optional fraction. ".5" is allowed; "1." and "1,23" are not.
 */
const MONEY_INPUT_PATTERN = /^(-)?(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d+))?$/

/**
 * Parse a user-typed amount such as "1,234.56" into minor units without ever
 * going through `parseFloat`. Returns a result object instead of throwing so
 * form validation can map each error to a message.
 *
 * Expects "." as the decimal separator and "," for grouping (en-US style).
 */
export function parseMoney(input: string, currency: CurrencyCode): ParseMoneyResult {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, error: 'EMPTY' }

  const match = MONEY_INPUT_PATTERN.exec(trimmed)
  if (!match) return { ok: false, error: 'INVALID_FORMAT' }

  const [, sign, wholeRaw = '', fraction = ''] = match
  const whole = wholeRaw.replaceAll(',', '')
  if (whole === '' && fraction === '') return { ok: false, error: 'INVALID_FORMAT' }

  const digits = minorUnits(currency)
  if (fraction.length > digits) return { ok: false, error: 'TOO_MANY_DECIMALS' }

  // "12.5" in USD → "12" + "50" → 1250n
  const magnitude = BigInt((whole || '0') + fraction.padEnd(digits, '0'))
  const amount = sign ? -magnitude : magnitude

  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
    return { ok: false, error: 'OUT_OF_RANGE' }
  }
  return { ok: true, value: money(Number(amount), currency) }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Exact decimal string in major units: 123456 USD → "1234.56", -5 USD → "-0.05",
 * 1500 JPY → "1500". Useful for `<input>` default values and APIs.
 */
export function toDecimalString(value: Money): string {
  const digits = minorUnits(value.currency)
  const negative = value.amount < 0
  const absolute = String(Math.abs(value.amount)).padStart(digits + 1, '0')

  const whole = absolute.slice(0, absolute.length - digits)
  const fraction = absolute.slice(absolute.length - digits)
  return `${negative ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`
}

export interface FormatMoneyOptions {
  /** BCP 47 locale. Defaults to "en-US" so output is deterministic. */
  locale?: string
  /** "always" renders "+$5.00" — useful for income/expense columns. */
  signDisplay?: Intl.NumberFormatOptions['signDisplay']
}

// Creating an Intl.NumberFormat is relatively expensive; a table with
// hundreds of rows would otherwise build hundreds of identical formatters.
const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(
  locale: string,
  currency: CurrencyCode,
  signDisplay: FormatMoneyOptions['signDisplay'],
) {
  const key = `${locale}|${currency}|${signDisplay ?? 'auto'}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      signDisplay: signDisplay ?? 'auto',
    })
    formatterCache.set(key, formatter)
  }
  return formatter
}

/**
 * Locale-aware display string, e.g. "$1,234.56", "¥1,500", "1.234,56 €".
 *
 * Passes Intl an exact decimal *string* (supported since Intl.NumberFormat v3)
 * instead of `amount / 100`, so no float is ever created.
 */
export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const formatter = getFormatter(options.locale ?? 'en-US', value.currency, options.signDisplay)
  return formatter.format(toDecimalString(value) as Intl.StringNumericLiteral)
}
