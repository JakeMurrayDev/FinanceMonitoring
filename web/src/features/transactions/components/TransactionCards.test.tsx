import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectNoAxeViolations } from '@/test/axe'
import { currentSearch, renderApp } from '@/test/render'
import { mockPhoneViewport } from '@/test/viewport'

describe('Transactions on a phone', () => {
  beforeEach(() => {
    mockPhoneViewport()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows one card per transaction with the amount in view, instead of a table', async () => {
    renderApp('/transactions')

    const list = await screen.findByRole('list', { name: 'Transactions' })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const [first, ...rest] = within(list).getAllByRole('listitem')
    expect(rest).toHaveLength(2)
    if (!first) throw new Error('No transaction cards')
    expect(first).toHaveTextContent('Sushi Ran')
    expect(first).toHaveTextContent('-$98.00')
    expect(first).toHaveTextContent('Expense')
    expect(within(first).getByRole('button', { name: 'Actions for Sushi Ran' })).toBeInTheDocument()
  })

  it('sorts with a select, since there are no column headers', async () => {
    const { user, router } = renderApp('/transactions')
    await screen.findByRole('list', { name: 'Transactions' })

    expect(screen.getByLabelText('Sort by')).toHaveValue('Date:Desc')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Amount, high to low')

    await waitFor(() => {
      expect(currentSearch(router).get('sort')).toBe('Amount')
    })
  })

  it('passes axe checks', async () => {
    renderApp('/transactions')
    await screen.findByRole('list', { name: 'Transactions' })
    await expectNoAxeViolations()
  })
})
