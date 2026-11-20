import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { budgetDb } from '@/mocks/budgets'
import { server } from '@/mocks/server'
import { createGate } from '@/test/gate'
import { renderApp } from '@/test/render'

/** Record each budgets GET's month; optionally hold PUTs until the test opens the gate. */
function watchBudgets({ holdWrites = false } = {}) {
  const months: (string | null)[] = []
  const writes: unknown[] = []
  const gate = createGate()
  server.use(
    http.get('*/api/budgets', ({ request }) => {
      months.push(new URL(request.url).searchParams.get('month'))
    }),
    http.put('*/api/budgets/:categoryId', async ({ request }) => {
      writes.push(await request.clone().json())
      if (holdWrites) await gate.wait()
    }),
  )
  return { months, writes, ...gate }
}

const card = (name: string) => screen.getByRole('group', { name })

describe('BudgetsPage: month in the URL', () => {
  beforeEach(() => {
    // Fake only the clock so "this month" is November 2026; timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to the current month', async () => {
    const api = watchBudgets()
    renderApp('/budgets')

    expect(await screen.findByText('November 2026')).toBeInTheDocument()
    await screen.findByRole('group', { name: 'Groceries' })
    expect(api.months).toContain('2026-11')
  })

  it('shows the month from the URL, and moves between months', async () => {
    const api = watchBudgets()
    const { router, user } = renderApp('/budgets?month=2026-10')

    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    await screen.findByRole('group', { name: 'Groceries' })
    expect(api.months).toContain('2026-10')

    await user.click(screen.getByRole('link', { name: 'Previous month, September 2026' }))

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ month: '2026-09' })
    })
    expect(await screen.findByText('September 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Back to this month' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({})
    })
  })

  it('ignores an invalid month in the URL', async () => {
    const api = watchBudgets()
    renderApp('/budgets?month=2026-13')

    expect(await screen.findByText('November 2026')).toBeInTheDocument()
    await screen.findByRole('group', { name: 'Groceries' })
    expect(api.months).not.toContain('2026-13')
  })
})

describe('BudgetsPage: status is clear without relying on colour', () => {
  it('labels each category’s status in words, with an accessible progress bar', async () => {
    renderApp('/budgets?month=2026-11')

    const groceries = await screen.findByRole('group', { name: 'Groceries' })
    expect(groceries).toHaveTextContent('Over budget')
    expect(groceries).toHaveTextContent('$8.41 over budget')
    const bar = within(groceries).getByRole('progressbar', { name: 'Groceries' })
    expect(bar).toHaveAttribute('aria-valuetext', '$308.41 of $300.00 spent, 102%')
    expect(bar).toHaveAttribute('aria-valuenow', '100') // capped; the text has the real figure

    expect(card('Dining Out')).toHaveTextContent('Near limit')
    expect(card('Dining Out')).toHaveTextContent('$11.87 left')
    expect(card('Utilities')).toHaveTextContent('On track')
    expect(card('Health')).toHaveTextContent('No budget')
    expect(within(card('Health')).queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('summarises the month and names the categories that are over budget', async () => {
    renderApp('/budgets?month=2026-11')

    const summary = await screen.findByRole('region', { name: 'Month summary' })
    expect(summary).toHaveTextContent('Budgeted$620.00')
    expect(summary).toHaveTextContent('Spent$560.06')
    expect(summary).toHaveTextContent('Left to spend$59.94')
    expect(summary).toHaveTextContent('Plus $25.00 spent in categories without a budget.')
    expect(within(summary).getByRole('status')).toHaveTextContent(
      '1 category is over budget: Groceries.',
    )
  })
})

describe('BudgetsPage: editing', () => {
  it('saves a new budget optimistically and returns focus to the card', async () => {
    const api = watchBudgets({ holdWrites: true })
    const { user } = renderApp('/budgets?month=2026-11')
    const groceries = await screen.findByRole('group', { name: 'Groceries' })

    await user.click(within(groceries).getByRole('button', { name: 'Edit Groceries budget' }))
    const input = within(groceries).getByLabelText('Monthly budget for Groceries')
    expect(input).toHaveValue('300.00')
    expect(input).toHaveFocus()
    expect(input).toHaveAccessibleDescription(
      'Applies from November 2026 onward. Earlier months keep their budget.',
    )

    await user.clear(input)
    await user.type(input, '400{Enter}')

    // Before the server answers: new budget, recalculated status and summary.
    expect(groceries).toHaveTextContent('$308.41 of $400.00')
    expect(groceries).toHaveTextContent('On track')
    expect(
      within(screen.getByRole('region', { name: 'Month summary' })).getByRole('status'),
    ).toHaveTextContent('Every budgeted category is within its limit.')
    expect(within(groceries).getByRole('button', { name: 'Edit Groceries budget' })).toHaveFocus()
    expect(api.writes[0]).toEqual({ month: '2026-11', amount: 40_000, version: null })

    api.open()
    expect(
      await screen.findByText('Groceries: $400.00 a month from November 2026.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['0', 'Enter a budget greater than zero.'],
    ['12.345', 'Use at most 2 decimal places.'],
    ['', 'Enter a budget.'],
  ])('rejects %j inline without calling the API', async (value, message) => {
    const api = watchBudgets()
    const { user } = renderApp('/budgets?month=2026-11')
    const groceries = await screen.findByRole('group', { name: 'Groceries' })

    await user.click(within(groceries).getByRole('button', { name: 'Edit Groceries budget' }))
    const input = within(groceries).getByLabelText('Monthly budget for Groceries')
    await user.clear(input)
    if (value) await user.type(input, value)
    await user.click(within(groceries).getByRole('button', { name: 'Save' }))

    expect(input).toHaveAccessibleDescription(expect.stringContaining(message) as string)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(api.writes).toHaveLength(0)
  })

  it('cancels with Escape', async () => {
    const { user } = renderApp('/budgets?month=2026-11')
    const groceries = await screen.findByRole('group', { name: 'Groceries' })

    await user.click(within(groceries).getByRole('button', { name: 'Edit Groceries budget' }))
    await user.keyboard('{Escape}')

    expect(within(groceries).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(groceries).getByRole('button', { name: 'Edit Groceries budget' })).toHaveFocus()
  })

  it('sets a budget on a category that has none', async () => {
    const { user } = renderApp('/budgets?month=2026-11')
    const health = await screen.findByRole('group', { name: 'Health' })

    await user.click(within(health).getByRole('button', { name: 'Set budget for Health' }))
    await user.type(within(health).getByLabelText('Monthly budget for Health'), '20{Enter}')

    expect(health).toHaveTextContent('$25.00 of $20.00')
    expect(health).toHaveTextContent('Over budget')
  })

  it('removes a budget from this month on', async () => {
    const { user } = renderApp('/budgets?month=2026-11')
    const utilities = await screen.findByRole('group', { name: 'Utilities' })

    await user.click(within(utilities).getByRole('button', { name: 'Remove Utilities budget' }))

    expect(utilities).toHaveTextContent('No budget')
    expect(
      within(utilities).getByRole('button', { name: 'Set budget for Utilities' }),
    ).toHaveFocus()
    expect(
      await screen.findByText('Removed the Utilities budget from November 2026.'),
    ).toBeInTheDocument()
  })

  it('rolls back and explains a conflict', async () => {
    const { user } = renderApp('/budgets?month=2026-11')
    const groceries = await screen.findByRole('group', { name: 'Groceries' })
    // Someone else sets November's Groceries budget first (creating version 1).
    budgetDb.change('groceries', '2026-11', 35_000, null)

    await user.click(within(groceries).getByRole('button', { name: 'Edit Groceries budget' }))
    const input = within(groceries).getByLabelText('Monthly budget for Groceries')
    await user.clear(input)
    await user.type(input, '400{Enter}')

    expect(
      await screen.findByText(
        'The Groceries budget was changed elsewhere, so this change wasn’t saved.',
      ),
    ).toBeInTheDocument()
    // After rollback and refetch: the other person's $350.00, not ours.
    await waitFor(() => {
      expect(groceries).toHaveTextContent('$308.41 of $350.00')
    })
  })
})

describe('BudgetsPage: loading and errors', () => {
  it('shows a loading state, then an error with a working retry', async () => {
    server.use(
      http.get(
        '*/api/budgets',
        () => HttpResponse.json({ title: 'Service unavailable', status: 503 }, { status: 503 }),
        {
          once: true,
        },
      ),
    )
    const { user } = renderApp('/budgets?month=2026-11')

    expect(await screen.findByRole('status', { name: 'Loading budgets' })).toBeInTheDocument()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Couldn’t load budgets')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('group', { name: 'Groceries' })).toBeInTheDocument()
  })
})
