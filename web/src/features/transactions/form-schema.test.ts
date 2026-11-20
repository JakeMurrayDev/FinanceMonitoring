import { describe, expect, it } from 'vitest'

import { createTransactionFormSchema, toFormInput, type TransactionFormInput } from './form-schema'

const TODAY = '2026-11-20'
const schema = createTransactionFormSchema(TODAY)

const valid: TransactionFormInput = {
  type: 'Expense',
  amount: '12.50',
  date: '2026-11-19',
  categoryId: 'dining',
  description: '  Sushi Ran ',
}

function errorFor(input: Partial<TransactionFormInput>, field: keyof TransactionFormInput) {
  const result = schema.safeParse({ ...valid, ...input })
  return result.success ? undefined : result.error.issues.find((i) => i.path[0] === field)?.message
}

describe('transaction form schema', () => {
  it('turns valid input into what the API expects: integer cents, trimmed text', () => {
    expect(schema.parse(valid)).toEqual({
      type: 'Expense',
      amount: 1250,
      date: '2026-11-19',
      categoryId: 'dining',
      description: 'Sushi Ran',
    })
  })

  it.each([
    ['', 'Enter an amount.'],
    ['abc', 'Enter an amount like 12.50.'],
    ['12.345', 'Use at most 2 decimal places.'],
    ['0', 'Enter an amount greater than zero.'],
    ['0.00', 'Enter an amount greater than zero.'],
    ['-5', 'Enter an amount greater than zero.'],
    ['99999999999999999', 'That amount is too large.'],
  ])('rejects amount %j: %s', (amount, message) => {
    expect(errorFor({ amount }, 'amount')).toBe(message)
  })

  it.each([
    ['4.35', 435], // parseFloat('4.35') * 100 is 434.99999999999994
    ['1,234.56', 123456],
    ['.5', 50],
  ])('parses amount %j exactly as %i cents', (amount, cents) => {
    expect(schema.parse({ ...valid, amount }).amount).toBe(cents)
  })

  it('allows today but not tomorrow', () => {
    expect(errorFor({ date: TODAY }, 'date')).toBeUndefined()
    expect(errorFor({ date: '2026-11-21' }, 'date')).toBe('Date can’t be in the future.')
  })

  it.each([
    [{ date: '' }, 'date', 'Enter a date.'],
    [{ categoryId: '' }, 'categoryId', 'Choose a category.'],
    [{ description: '   ' }, 'description', 'Enter a description.'],
    [{ description: 'x'.repeat(201) }, 'description', 'Use 200 characters or fewer.'],
  ] as const)('rejects %o', (input, field, message) => {
    expect(errorFor(input, field)).toBe(message)
  })
})

describe('toFormInput', () => {
  it('shows a saved amount as an exact decimal string', () => {
    expect(
      toFormInput({
        type: 'Income',
        amount: 485_000,
        date: '2026-11-01',
        categoryId: 'salary',
        description: 'Payroll',
      }),
    ).toEqual({
      type: 'Income',
      amount: '4850.00',
      date: '2026-11-01',
      categoryId: 'salary',
      description: 'Payroll',
    })
  })
})
