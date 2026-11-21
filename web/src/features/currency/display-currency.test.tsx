import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { eurRate } from '@/mocks/dashboard'
import { server } from '@/mocks/server'
import { renderApp } from '@/test/render'

// Expected values are hand-checked at 1 USD = 0.90975 EUR, rounded half-to-even:
//   9,800 × 0.90975 = 8,915.55  → -€89.16     30,000 × 0.90975 = 27,292.5 → €272.92 (to even)
// 485,000 × 0.90975 = 441,228.75 → +€4,412.29  30,841 × 0.90975 = 28,057.6 → €280.58
//    -841 × 0.90975 = -765.1      → €7.65 over  62,000 × 0.90975 = 56,404.5 → €564.04 (to even)

const useEur = () => {
  localStorage.setItem('finance-monitor:display-currency', 'EUR')
}

describe('Display currency across pages', () => {
  it('applies a currency picked on the dashboard to transactions and budgets', async () => {
    const { user } = renderApp('/?month=2026-11')
    await screen.findByText('$4,850.00')
    await screen.findByRole('option', { name: 'EUR — Euro' })

    await user.selectOptions(screen.getByLabelText('Display currency'), 'EUR')
    await screen.findByText('€4,412.29')

    await user.click(screen.getByRole('link', { name: 'Transactions' }))
    expect(await screen.findByText('-€89.16')).toBeInTheDocument()
    expect(screen.getByText('+€4,412.29')).toBeInTheDocument()
    expect(
      screen.getByText(/Converted from USD at 1 USD = 0\.90975 EUR \(ECB reference rate/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Budgets' }))
    const groceries = await screen.findByRole('group', { name: 'Groceries' })
    expect(within(groceries).getByText('€7.65 over budget')).toBeInTheDocument()
    expect(within(groceries).getByText(/of €272\.92/)).toBeInTheDocument()
    expect(screen.getByText('€564.04')).toBeInTheDocument()
    expect(screen.getByText(/Budgets are set in USD/)).toBeInTheDocument()
  })

  it('goes back to dollars, with no rate notice, when USD is picked', async () => {
    useEur()
    const { user } = renderApp('/transactions')
    await screen.findByText('-€89.16')
    await screen.findByRole('option', { name: 'USD — US Dollar' })

    await user.selectOptions(screen.getByLabelText('Display currency'), 'USD')

    expect(await screen.findByText('-$98.00')).toBeInTheDocument()
    expect(screen.queryByText(/Converted from USD/)).not.toBeInTheDocument()
  })

  it('falls back to USD and says so when the rate is unavailable', async () => {
    useEur()
    server.use(
      http.get('*/api/rates/:currency', () =>
        HttpResponse.json(
          { title: 'Exchange rates are unavailable right now.', status: 503 },
          { status: 503 },
        ),
      ),
    )
    renderApp('/transactions')

    expect(await screen.findByText('Exchange rates are unavailable right now')).toBeInTheDocument()
    expect(
      screen.getByText('Showing amounts in USD instead. Try EUR again later.'),
    ).toBeInTheDocument()
    expect(screen.getByText('-$98.00')).toBeInTheDocument()
  })

  it('warns when the rate is out of date', async () => {
    useEur()
    server.use(http.get('*/api/rates/:currency', () => HttpResponse.json(eurRate(true))))
    renderApp('/budgets?month=2026-11')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Exchange rates couldn’t be refreshed')
    expect(alert).toHaveTextContent('1 USD = 0.90975 EUR')
  })

  it('keeps budgets edited and saved in USD while showing euros', async () => {
    useEur()
    const writes: unknown[] = []
    server.use(
      http.put('*/api/budgets/:categoryId', async ({ request }) => {
        writes.push(await request.clone().json())
      }),
    )
    const { user } = renderApp('/budgets?month=2026-11')
    const groceries = await screen.findByRole('group', { name: 'Groceries' })
    await within(groceries).findByText(/of €272\.92/)

    await user.click(within(groceries).getByRole('button', { name: 'Edit Groceries budget' }))
    const input = within(groceries).getByLabelText('Monthly budget for Groceries')
    expect(input).toHaveValue('300.00')
    expect(input).toHaveAccessibleDescription(/Budgets are set in USD\./)

    await user.clear(input)
    await user.type(input, '350{Enter}')

    await waitFor(() => {
      expect(writes).toEqual([expect.objectContaining({ amount: 35_000 })])
    })
    // 35,000 × 0.90975 = 31,841.25 → €318.41
    expect(await within(groceries).findByText(/of €318\.41/)).toBeInTheDocument()
  })
})
