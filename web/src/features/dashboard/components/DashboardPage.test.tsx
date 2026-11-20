import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { eurDashboard } from '@/mocks/dashboard'
import { server } from '@/mocks/server'
import { renderApp } from '@/test/render'

/** Record the query string of each dashboard request. */
function watchDashboard() {
  const requests: URLSearchParams[] = []
  server.use(
    http.get('*/api/dashboard', ({ request }) => {
      requests.push(new URL(request.url).searchParams)
    }),
  )
  return requests
}

const tile = (label: string) => {
  const tileElement = screen.getByText(label, { selector: 'dt' }).parentElement
  if (!tileElement) throw new Error(`No tile for ${label}`)
  return tileElement
}

describe('Dashboard: KPIs', () => {
  it('shows totals with the change from last month in words', async () => {
    renderApp('/?month=2026-11')
    await screen.findByText('$4,850.00')

    expect(tile('Income')).toHaveTextContent('$4,850.00')
    expect(tile('Income')).toHaveTextContent('Down 14% from October')
    expect(tile('Expenses')).toHaveTextContent('$2,337.96')
    expect(tile('Expenses')).toHaveTextContent('Down 12% from October')
    expect(tile('Net')).toHaveTextContent('$2,512.04')
    expect(tile('Savings rate')).toHaveTextContent('51.8%')
    expect(tile('Savings rate')).toHaveTextContent('Down 1.1 pts from October')
  })

  it('marks spending going down as good news and income going down as bad', async () => {
    renderApp('/?month=2026-11')
    await screen.findByText('$4,850.00')

    // Colour repeats the meaning; the words above carry it.
    expect(within(tile('Expenses')).getByText('Down 12% from October')).toHaveClass('text-income')
    expect(within(tile('Income')).getByText('Down 14% from October')).toHaveClass('text-expense')
  })
})

describe('Dashboard: charts have text and table equivalents', () => {
  it('summarises spending by category, folding the tail into Other', async () => {
    const { user } = renderApp('/?month=2026-11')
    const section = await screen.findByRole('region', { name: 'Spending by category' })

    expect(section).toHaveTextContent(
      'Rent is the largest expense at $1,650.00, 71% of spending across 8 categories.',
    )

    await user.click(within(section).getByRole('button', { name: 'Show table' }))

    const rows = within(within(section).getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      'Rent$1,650.0071%',
      'Groceries$308.4113%',
      'Utilities$143.526%',
      'Dining Out$108.135%',
      'Transport$92.424%',
      'Subscriptions$27.481%',
      'Other (2)$8.000%',
    ])
    expect(within(section).getByRole('button', { name: 'Show chart' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('summarises the six-month trend and offers every value as a table', async () => {
    const { user } = renderApp('/?month=2026-11')
    const section = await screen.findByRole('region', { name: 'Six-month trend' })

    expect(section).toHaveTextContent(
      'Net was positive in 6 of 6 months. Highest spending: September 2026 at $3,279.79.',
    )

    await user.click(within(section).getByRole('button', { name: 'Show table' }))
    const table = within(section).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(7)
    expect(within(table).getByRole('row', { name: /November 2026/ })).toHaveTextContent(
      'November 2026$4,850.00$2,337.96$2,512.04',
    )
  })
})

describe('Dashboard: display currency', () => {
  it('converts on the server, explains the rate, and remembers the choice', async () => {
    const requests = watchDashboard()
    const { user, unmount } = renderApp('/?month=2026-11')
    await screen.findByText('$4,850.00')

    await user.selectOptions(screen.getByLabelText('Display currency'), 'EUR')

    expect(await screen.findByText('€4,412.29')).toBeInTheDocument()
    expect(requests.at(-1)?.get('currency')).toBe('EUR')
    expect(
      screen.getByText(
        /Converted from USD at 1 USD = 0\.90975 EUR \(ECB reference rate, Nov 19, 2026\)/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/categories may not add up to the total to the cent/),
    ).toBeInTheDocument()

    // A reload keeps EUR.
    unmount()
    renderApp('/?month=2026-11')
    expect(await screen.findByText('€4,412.29')).toBeInTheDocument()
    expect(screen.getByLabelText('Display currency')).toHaveValue('EUR')
  })

  it('warns when the rate is out of date', async () => {
    localStorage.setItem('finance-monitor:display-currency', 'EUR')
    server.use(http.get('*/api/dashboard', () => HttpResponse.json(eurDashboard('2026-11', true))))
    renderApp('/?month=2026-11')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Exchange rates couldn’t be refreshed')
    expect(alert).toHaveTextContent(
      'Showing amounts at the last available rate: 1 USD = 0.90975 EUR',
    )
  })

  it('falls back to USD and says so when rates are unavailable', async () => {
    localStorage.setItem('finance-monitor:display-currency', 'EUR')
    server.use(
      http.get('*/api/dashboard', ({ request }) =>
        new URL(request.url).searchParams.get('currency') === 'EUR'
          ? HttpResponse.json(
              { title: 'Exchange rates are unavailable right now.', status: 503 },
              { status: 503 },
            )
          : undefined,
      ),
    )
    renderApp('/?month=2026-11')

    expect(await screen.findByText('Exchange rates are unavailable right now')).toBeInTheDocument()
    expect(
      screen.getByText('Showing amounts in USD instead. Try EUR again later.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('$4,850.00')).toBeInTheDocument()
  })
})

describe('Dashboard: month and states', () => {
  it('reads the month from the URL and moves between months', async () => {
    const requests = watchDashboard()
    const { user, router } = renderApp('/?month=2026-10')
    await screen.findByText('October 2026')
    await waitFor(() => {
      expect(requests.some((r) => r.get('month') === '2026-10')).toBe(true)
    })

    await user.click(screen.getByRole('link', { name: 'Next month, November 2026' }))

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ month: '2026-11' })
    })
  })

  it('shows loading, then an error with a working retry', async () => {
    server.use(
      http.get(
        '*/api/dashboard',
        () => HttpResponse.json({ title: 'Service unavailable', status: 500 }, { status: 500 }),
        {
          once: true,
        },
      ),
    )
    const { user } = renderApp('/?month=2026-11')

    expect(await screen.findByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Couldn’t load the dashboard')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('$4,850.00')).toBeInTheDocument()
  })

  it('handles a month with no spending', async () => {
    server.use(
      http.get('*/api/dashboard', () =>
        HttpResponse.json({
          month: '2026-11',
          currency: 'USD',
          rate: null,
          totals: { income: 0, expenses: 0, net: 0 },
          previous: { income: 0, expenses: 0, net: 0 },
          savingsRateBasisPoints: null,
          byCategory: [],
          trend: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map(
            (month) => ({
              month,
              income: 0,
              expenses: 0,
              net: 0,
            }),
          ),
        }),
      ),
    )
    renderApp('/?month=2026-11')

    expect(await screen.findByText('No spending this month.')).toBeInTheDocument()
    expect(screen.getByText('No activity in these six months.')).toBeInTheDocument()
    expect(tile('Savings rate')).toHaveTextContent('—')
  })
})
