import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { mockCategories } from '@/mocks/data'

import type { TransactionFormInput } from '../form-schema'
import { TransactionForm, type TransactionFormProps } from './TransactionForm'

const TODAY = '2026-11-20'

function renderForm(props: Partial<TransactionFormProps> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  const user = userEvent.setup()
  render(
    <TransactionForm
      categories={mockCategories}
      today={TODAY}
      submitLabel="Save transaction"
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  )
  const field = {
    amount: screen.getByLabelText('Amount (USD)'),
    date: screen.getByLabelText('Date'),
    category: screen.getByLabelText('Category'),
    description: screen.getByLabelText('Description'),
  }
  const submit = () => user.click(screen.getByRole('button', { name: 'Save transaction' }))
  return { user, onSubmit, onCancel, field, submit }
}

describe('TransactionForm: validation messages', () => {
  it('reports every missing field, links each message to its input, and focuses the first', async () => {
    const { field, submit, onSubmit } = renderForm()

    await submit()

    expect(field.amount).toHaveAccessibleDescription('Enter an amount.')
    expect(field.category).toHaveAccessibleDescription('Choose a category.')
    expect(field.description).toHaveAccessibleDescription('Enter a description.')
    for (const input of [field.amount, field.category, field.description]) {
      expect(input).toHaveAttribute('aria-invalid', 'true')
    }
    expect(field.date).not.toHaveAttribute('aria-invalid') // defaults to today
    expect(field.amount).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each([
    ['0', 'Enter an amount greater than zero.'],
    ['-20', 'Enter an amount greater than zero.'],
    ['12.345', 'Use at most 2 decimal places.'],
    ['12,5', 'Enter an amount like 12.50.'],
  ])('rejects amount %j with “%s”', async (amount, message) => {
    const { user, field, submit } = renderForm()

    await user.type(field.amount, amount)
    await submit()

    expect(field.amount).toHaveAccessibleDescription(message)
  })

  it('rejects a date in the future', async () => {
    const { user, field, submit } = renderForm()

    await user.clear(field.date)
    await user.type(field.date, '2026-11-21')
    await submit()

    expect(field.date).toHaveAccessibleDescription('Date can’t be in the future.')
    expect(field.date).toHaveAttribute('max', TODAY)
  })

  it('clears a message as soon as the field is fixed', async () => {
    const { user, field, submit } = renderForm()
    await user.type(field.amount, '12.345')
    await submit()
    expect(field.amount).toHaveAccessibleDescription('Use at most 2 decimal places.')

    await user.type(field.amount, '{Backspace}')

    expect(field.amount).not.toHaveAccessibleDescription()
    expect(field.amount).not.toHaveAttribute('aria-invalid')
  })

  it('shows field errors returned by the server', () => {
    const { field } = renderForm({
      serverErrors: { categoryId: ['Salary is an income category.'] },
    })

    expect(field.category).toHaveAccessibleDescription('Salary is an income category.')
  })
})

describe('TransactionForm: submitting', () => {
  it('submits integer cents and trimmed text', async () => {
    const { user, field, submit, onSubmit } = renderForm()

    await user.type(field.amount, '12.50')
    await user.selectOptions(field.category, 'Dining Out')
    await user.type(field.description, '  Sushi Ran ')
    await submit()

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      type: 'Expense',
      amount: 1250,
      date: TODAY,
      categoryId: 'dining',
      description: 'Sushi Ran',
    })
  })

  it('submits income with an income category', async () => {
    const { user, field, submit, onSubmit } = renderForm()

    await user.click(screen.getByRole('radio', { name: 'Income' }))
    await user.type(field.amount, '4,850')
    await user.selectOptions(field.category, 'Salary')
    await user.type(field.description, 'Payroll')
    await submit()

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      type: 'Income',
      amount: 485_000,
      categoryId: 'salary',
    })
  })

  it('pre-fills existing values when editing', () => {
    const existing: TransactionFormInput = {
      type: 'Income',
      amount: '4850.00',
      date: '2026-11-01',
      categoryId: 'salary',
      description: 'Payroll',
    }
    const { field } = renderForm({ defaultValues: existing })

    expect(screen.getByRole('radio', { name: 'Income' })).toBeChecked()
    expect(field.amount).toHaveValue('4850.00')
    expect(field.date).toHaveValue('2026-11-01')
    expect(field.category).toHaveValue('salary')
    expect(field.description).toHaveValue('Payroll')
  })

  it('cancels without submitting', async () => {
    const { user, onCancel, onSubmit } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('TransactionForm: categories follow the type', () => {
  it('only offers categories matching the selected type, and clears one that no longer fits', async () => {
    const { user, field } = renderForm()
    const optionNames = () =>
      within(field.category)
        .getAllByRole('option')
        .map((o) => o.textContent)

    expect(optionNames()).toEqual(['Choose a category', 'Dining Out', 'Groceries', 'Rent'])
    await user.selectOptions(field.category, 'Groceries')

    await user.click(screen.getByRole('radio', { name: 'Income' }))

    expect(optionNames()).toEqual(['Choose a category', 'Freelance', 'Salary'])
    expect(field.category).toHaveValue('')
  })
})
