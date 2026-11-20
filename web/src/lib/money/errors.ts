export type MoneyErrorCode =
  'INVALID_CURRENCY' | 'CURRENCY_MISMATCH' | 'NOT_AN_INTEGER' | 'OUT_OF_RANGE' | 'INVALID_RATE'

/**
 * Thrown for programmer errors (mixing currencies, passing a float as minor
 * units). User-input problems are returned as values by `parseMoney` instead,
 * so forms can show a message without try/catch.
 */
export class MoneyError extends Error {
  readonly code: MoneyErrorCode

  constructor(code: MoneyErrorCode, message: string) {
    super(message)
    this.name = 'MoneyError'
    this.code = code
  }
}
