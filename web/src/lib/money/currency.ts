import { MoneyError } from './errors'

/** ISO 4217 alphabetic code, e.g. "USD". Validated at runtime by {@link assertCurrencyCode}. */
export type CurrencyCode = string

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/

const minorUnitCache = new Map<CurrencyCode, number>()

/**
 * Throws unless `code` is shaped like an ISO 4217 code (three uppercase
 * letters). Intl accepts any well-formed code — unknown ones get 2 decimals —
 * so checking against a real list of currencies is left to the caller
 * (Phase 5 uses the list Frankfurter supports).
 */
export function assertCurrencyCode(code: string): asserts code is CurrencyCode {
  minorUnits(code)
}

/**
 * Number of decimal places in a currency's minor unit:
 * USD → 2 (cents), JPY → 0 (no minor unit), KWD → 3 (fils).
 *
 * Derived from Intl (CLDR data) rather than hard-coded, so every currency
 * the browser knows about works without a lookup table.
 */
export function minorUnits(currency: CurrencyCode): number {
  const cached = minorUnitCache.get(currency)
  if (cached !== undefined) return cached

  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    throw new MoneyError('INVALID_CURRENCY', `Invalid currency code: "${currency}"`)
  }

  // `?? 2` only satisfies the type: currency-style formats always resolve this option.
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2

  minorUnitCache.set(currency, digits)
  return digits
}
