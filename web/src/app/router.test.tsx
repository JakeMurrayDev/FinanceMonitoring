import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createQueryClient } from './query-client'
import { createAppRouter } from './router'

/** Render the real route tree at a given URL, without a browser. */
function renderAt(url: string) {
  const history = createMemoryHistory({ initialEntries: [url] })
  const router = createAppRouter(createQueryClient(), history)
  render(<RouterProvider router={router} />)
  return router
}

describe('routing shell', () => {
  it('renders the dashboard at /', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates via the main nav and marks the active link', async () => {
    const user = userEvent.setup()
    renderAt('/')

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    await user.click(screen.getByRole('link', { name: 'Transactions' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Transactions' }),
    ).toBeInTheDocument()
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('Transactions')
  })

  it('shows a not-found page for unknown URLs', async () => {
    renderAt('/does-not-exist')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('offers a skip link for keyboard users', async () => {
    renderAt('/budgets')
    await screen.findByRole('heading', { level: 1, name: 'Budgets' })
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    )
  })
})
