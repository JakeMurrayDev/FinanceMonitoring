import { z } from 'zod'

import type { TransactionItem } from '@/api/types'
import { money, parseMoney, toDecimalString, type ParseMoneyError } from '@/lib/money'

import { TRANSACTION_TYPES } from './search-schema'

/** Every transaction is in the account currency for now; Phase 5 converts for display. */
export const ACCOUNT_CURRENCY = 'USD'

const AMOUNT_MESSAGES: Record<ParseMoneyError, string> = {
  EMPTY: 'Enter an amount.',
  INVALID_FORMAT: 'Enter an amount like 12.50.',
  TOO_MANY_DECIMALS: 'Use at most 2 decimal places.',
  OUT_OF_RANGE: 'That amount is too large.',
}

/**
 * Validation for the add/edit form. Messages match the API's, and the API
 * re-checks every rule. `today` is a parameter so tests can pin the date.
 *
 * Input is what the fields hold (strings); output is what the API takes:
 * the amount as integer minor units ("12.50" → 1250), parsed without floats.
 */
export function createTransactionFormSchema(today: string) {
  return z.object({
    type: z.enum(TRANSACTION_TYPES),
    amount: z.string().transform((value, ctx) => {
      const parsed = parseMoney(value, ACCOUNT_CURRENCY)
      if (!parsed.ok) {
        ctx.issues.push({ code: 'custom', message: AMOUNT_MESSAGES[parsed.error], input: value })
        return z.NEVER
      }
      if (parsed.value.amount <= 0) {
        ctx.issues.push({
          code: 'custom',
          message: 'Enter an amount greater than zero.',
          input: value,
        })
        return z.NEVER
      }
      return parsed.value.amount
    }),
    date: z
      .string()
      .min(1, { error: 'Enter a date.' })
      .pipe(z.iso.date({ error: 'Enter a valid date.' }))
      .refine((date) => date <= today, { error: 'Date can’t be in the future.' }),
    categoryId: z.string().min(1, { error: 'Choose a category.' }),
    description: z
      .string()
      .trim()
      .min(1, { error: 'Enter a description.' })
      .max(200, { error: 'Use 200 characters or fewer.' }),
  })
}

export type TransactionFormInput = z.input<ReturnType<typeof createTransactionFormSchema>>
export type TransactionFormValues = z.output<ReturnType<typeof createTransactionFormSchema>>

export function emptyFormInput(today: string): TransactionFormInput {
  return { type: 'Expense', amount: '', date: today, categoryId: '', description: '' }
}

/** Pre-fill the form from a saved transaction (or a draft that failed to save). */
export function toFormInput(
  item: Pick<TransactionItem, 'type' | 'amount' | 'date' | 'categoryId' | 'description'>,
): TransactionFormInput {
  return {
    type: item.type,
    amount: toDecimalString(money(item.amount, ACCOUNT_CURRENCY)),
    date: item.date,
    categoryId: item.categoryId,
    description: item.description,
  }
}
