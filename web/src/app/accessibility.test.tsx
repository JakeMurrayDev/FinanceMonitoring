import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '@/test/axe'
import { renderApp } from '@/test/render'

/**
 * Automated WCAG checks (axe-core) on every page and the main interactive
 * states. They catch missing labels, bad ARIA, duplicate ids, heading-order
 * and landmark problems. Keyboard and screen-reader behaviour are covered by
 * the feature tests and a manual pass.
 */
describe('Accessibility (axe)', () => {
  it('Dashboard', async () => {
    renderApp('/?month=2026-11')
    await screen.findByText('$4,850.00')
    await expectNoAxeViolations()
  })

  it('Dashboard with chart tables shown', async () => {
    const { user } = renderApp('/?month=2026-11')
    await screen.findByText('$4,850.00')
    // Charts load lazily, so wait until both are on screen before toggling them.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Show table' })).toHaveLength(2)
    })
    for (const button of screen.getAllByRole('button', { name: 'Show table' })) {
      await user.click(button)
    }
    await expectNoAxeViolations()
  })

  it('Transactions', async () => {
    renderApp('/transactions')
    await screen.findByRole('table')
    await expectNoAxeViolations()
  })

  it('Transactions with the category filter open', async () => {
    const { user } = renderApp('/transactions')
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Categories' }))
    await screen.findByRole('checkbox', { name: 'Dining Out' })
    await expectNoAxeViolations()
  })

  it('Add transaction dialog, with validation errors', async () => {
    const { user } = renderApp('/transactions/new')
    const dialog = await screen.findByRole('dialog', { name: 'Add transaction' })
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }))
    await within(dialog).findByText('Enter an amount.')
    await expectNoAxeViolations()
  })

  it('Delete confirmation', async () => {
    const { user } = renderApp('/transactions')
    await user.click(await screen.findByRole('button', { name: 'Actions for Sushi Ran' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await screen.findByRole('alertdialog')
    await expectNoAxeViolations()
  })

  it('Budgets, with an editor open', async () => {
    const { user } = renderApp('/budgets?month=2026-11')
    const groceries = await screen.findByRole('group', { name: 'Groceries' })
    await expectNoAxeViolations()
    await user.click(within(groceries).getByRole('button', { name: 'Edit Groceries budget' }))
    await expectNoAxeViolations()
  })

  it('Not found page', async () => {
    renderApp('/nope')
    await screen.findByRole('heading', { name: 'Page not found' })
    await expectNoAxeViolations()
  })
})
