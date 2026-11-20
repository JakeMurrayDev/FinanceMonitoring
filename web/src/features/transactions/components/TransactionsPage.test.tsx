import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { TransactionPage } from '@/api/types'
import { mockTransactions, pageOf } from '@/mocks/data'
import { server } from '@/mocks/server'
import { currentSearch, renderApp } from '@/test/render'

/** Serve `page` for every transactions request and record each request's query string. */
function serveTransactions(
  page: (params: URLSearchParams) => TransactionPage = () => pageOf(mockTransactions),
) {
  const requests: URLSearchParams[] = []
  server.use(
    http.get('*/api/transactions', ({ request }) => {
      const params = new URL(request.url).searchParams
      requests.push(params)
      return HttpResponse.json(page(params))
    }),
  )
  return {
    requests,
    last: () => {
      const latest = requests.at(-1)
      if (!latest) throw new Error('No transactions request was made')
      return latest
    },
  }
}

const findTable = () => screen.findByRole('table')

describe('TransactionsPage: URL-driven filtering', () => {
  it('reads every filter from the URL into the controls and the API request', async () => {
    const api = serveTransactions()

    renderApp(
      '/transactions?search=sushi&type=Expense&category=dining&category=groceries' +
        '&from=2026-11-01&to=2026-11-30&sort=Amount&dir=Asc&page=2&pageSize=10',
    )
    await findTable()

    // The controls reflect the URL…
    expect(screen.getByLabelText('Search')).toHaveValue('sushi')
    expect(screen.getByLabelText('Type')).toHaveValue('Expense')
    expect(screen.getByLabelText('From')).toHaveValue('2026-11-01')
    expect(screen.getByLabelText('To')).toHaveValue('2026-11-30')
    expect(screen.getByRole('button', { name: 'Categories' })).toHaveAccessibleDescription(
      '2 selected',
    )
    expect(screen.getByRole('columnheader', { name: /amount/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    // …and so does the request sent to the API.
    const params = api.last()
    expect(params.get('search')).toBe('sushi')
    expect(params.get('type')).toBe('Expense')
    expect(params.getAll('category')).toEqual(['dining', 'groceries'])
    expect(params.get('from')).toBe('2026-11-01')
    expect(params.get('to')).toBe('2026-11-30')
    expect(params.get('sort')).toBe('Amount')
    expect(params.get('dir')).toBe('Asc')
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('10')
  })

  it('writes a filter change to the URL and goes back to page 1', async () => {
    const api = serveTransactions(() => pageOf(mockTransactions, { page: 3, totalCount: 100 }))
    const { router, user } = renderApp('/transactions?page=3')
    await findTable()

    await user.selectOptions(screen.getByLabelText('Type'), 'Income')

    await waitFor(() => {
      expect(currentSearch(router).get('type')).toBe('Income')
    })
    expect(currentSearch(router).has('page')).toBe(false) // page 1 is the default, so it's omitted
    await waitFor(() => {
      expect(api.last().get('type')).toBe('Income')
    })
    expect(api.last().get('page')).toBe('1')
  })

  it('debounces typing so only the finished search term reaches the URL and API', async () => {
    const api = serveTransactions()
    const { router, user } = renderApp('/transactions')
    await findTable()

    await user.type(screen.getByLabelText('Search'), 'coffee')

    await waitFor(() => {
      expect(currentSearch(router).get('search')).toBe('coffee')
    })
    await waitFor(() => {
      expect(api.last().get('search')).toBe('coffee')
    })
    // No request for "c", "co", "cof"…
    expect(api.requests.map((p) => p.get('search'))).toEqual([null, 'coffee'])
  })

  it('writes several selected categories as repeated URL params', async () => {
    const { router, user } = renderApp('/transactions')
    await findTable()

    await user.click(screen.getByRole('button', { name: 'Categories' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Dining Out' }))
    await user.click(screen.getByRole('checkbox', { name: 'Groceries' }))

    await waitFor(() => {
      expect(currentSearch(router).getAll('category')).toEqual(['dining', 'groceries'])
    })
    expect(router.state.location.href).toContain('category=dining&category=groceries')
  })

  it('sorts by clicking a column header, newest/largest first', async () => {
    const { router, user } = renderApp('/transactions')
    await findTable()

    await user.click(screen.getByRole('button', { name: 'Amount' }))
    await waitFor(() => {
      expect(currentSearch(router).get('sort')).toBe('Amount')
    })
    expect(currentSearch(router).has('dir')).toBe(false) // Desc is the default

    await user.click(screen.getByRole('button', { name: 'Amount' }))
    await waitFor(() => {
      expect(currentSearch(router).get('dir')).toBe('Asc')
    })
  })

  it('pages forward and announces the visible range', async () => {
    serveTransactions((params) =>
      pageOf(mockTransactions, { page: Number(params.get('page') ?? 1), totalCount: 60 }),
    )
    const { router, user } = renderApp('/transactions')
    await findTable()

    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–25 of 60 transactions')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() => {
      expect(currentSearch(router).get('page')).toBe('2')
    })
    expect(await screen.findByText('Showing 26–50 of 60 transactions')).toBeInTheDocument()
  })

  it('ignores a malformed URL and falls back to defaults', async () => {
    const api = serveTransactions()

    renderApp('/transactions?page=abc&type=bogus&pageSize=7&sort=nope')
    await findTable()

    expect(screen.getByLabelText('Type')).toHaveValue('')
    const params = api.last()
    expect(params.get('page')).toBe('1')
    expect(params.get('pageSize')).toBe('25')
    expect(params.get('sort')).toBe('Date')
    expect(params.has('type')).toBe(false)
  })
})

describe('TransactionsPage: rendering and states', () => {
  it('shows amounts with a sign and a text label, not colour alone', async () => {
    renderApp('/transactions')
    const table = await findTable()

    expect(within(table).getByText('+$4,850.00')).toBeInTheDocument()
    expect(within(table).getByText('-$1,650.00')).toBeInTheDocument()
    expect(within(table).getAllByText('Expense')).toHaveLength(2)
    expect(within(table).getByText('Income')).toBeInTheDocument()
    expect(within(table).getByText('Nov 18, 2026')).toBeInTheDocument()
  })

  it('shows a loading state while the first page loads', async () => {
    server.use(
      http.get('*/api/transactions', async () => {
        await delay(100)
        return HttpResponse.json(pageOf(mockTransactions))
      }),
    )
    renderApp('/transactions')

    expect(await screen.findByRole('status', { name: 'Loading transactions' })).toBeInTheDocument()
    expect(await findTable()).toBeInTheDocument()
  })

  it('shows an error with a retry that recovers', async () => {
    server.use(
      http.get(
        '*/api/transactions',
        () => HttpResponse.json({ title: 'Service unavailable', status: 503 }, { status: 503 }),
        { once: true },
      ),
    )
    const { user } = renderApp('/transactions')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Couldn’t load transactions')
    expect(alert).toHaveTextContent('Service unavailable')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await findTable()).toBeInTheDocument()
  })

  it('offers to clear filters when nothing matches', async () => {
    serveTransactions((params) => (params.has('type') ? pageOf([]) : pageOf(mockTransactions)))
    const { router, user } = renderApp('/transactions?type=Income&sort=Amount')

    const table = await findTable()
    expect(within(table).getByText('No transactions match your filters.')).toBeInTheDocument()

    await user.click(within(table).getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => {
      expect(currentSearch(router).has('type')).toBe(false)
    })
    expect(currentSearch(router).get('sort')).toBe('Amount') // sorting is kept
    expect(await screen.findByText('Sushi Ran')).toBeInTheDocument()
  })

  it('offers a way back from a page beyond the last one', async () => {
    serveTransactions((params) =>
      params.get('page') === '9'
        ? pageOf([], { page: 9, totalCount: 3 })
        : pageOf(mockTransactions),
    )
    const { router, user } = renderApp('/transactions?page=9')

    await user.click(await screen.findByRole('button', { name: 'Go to the first page' }))

    await waitFor(() => {
      expect(currentSearch(router).has('page')).toBe(false)
    })
  })

  it('flags a reversed date range without calling the API', async () => {
    const api = serveTransactions()
    renderApp('/transactions?from=2026-03-01&to=2026-02-01')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The start date must be on or before the end date.',
    )
    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(api.requests).toHaveLength(0)
  })
})
