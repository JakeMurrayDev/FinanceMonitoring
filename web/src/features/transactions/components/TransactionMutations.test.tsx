import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { db } from '@/mocks/db'
import { server } from '@/mocks/server'
import { createGate } from '@/test/gate'
import { renderApp } from '@/test/render'

/**
 * Hold one HTTP method on the transactions API until the test opens the gate.
 * The handler then returns nothing, so MSW falls through to the default
 * handler, which answers from the in-memory db.
 */
function holdRequests(method: 'post' | 'put' | 'delete') {
  const gate = createGate()
  const bodies: unknown[] = []
  const urls: URL[] = []
  const path = method === 'post' ? '*/api/transactions' : '*/api/transactions/:id'
  server.use(
    http[method](path, async ({ request }) => {
      urls.push(new URL(request.url))
      if (method !== 'delete') bodies.push(await request.clone().json())
      await gate.wait()
    }),
  )
  return { ...gate, bodies, urls }
}

async function openRowMenu(description: string) {
  const user = (await import('@testing-library/user-event')).default.setup()
  await user.click(await screen.findByRole('button', { name: `Actions for ${description}` }))
  return user
}

const row = (text: string) => screen.queryByRole('row', { name: new RegExp(text) })

describe('Adding a transaction', () => {
  it('opens the form as a dialog route, then shows the new row as “Saving…” until the server confirms it', async () => {
    const post = holdRequests('post')
    const { user, router } = renderApp('/transactions?type=Expense')
    await screen.findByRole('table')

    await user.click(screen.getByRole('link', { name: 'Add transaction' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add transaction' })
    expect(router.state.location.pathname).toBe('/transactions/new')
    expect(router.state.location.search).toMatchObject({ type: 'Expense' }) // filters kept underneath

    await user.type(within(dialog).getByLabelText('Amount (USD)'), '12.50')
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Dining Out')
    await user.type(within(dialog).getByLabelText('Description'), 'Blue Bottle Coffee')
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }))

    // Optimistic: the dialog has closed and the row is already visible, marked as saving.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/transactions')
    const pending = await screen.findByRole('row', { name: /Blue Bottle Coffee.*Saving…/ })
    expect(pending).toHaveAttribute('aria-busy', 'true')
    expect(post.bodies[0]).toMatchObject({ amount: 1250, currency: 'USD', categoryId: 'dining' })

    post.open()

    // After the server confirms and the list refetches: a normal row, and a toast.
    await waitFor(() => {
      expect(screen.queryByText('Saving…')).not.toBeInTheDocument()
    })
    expect(row('Blue Bottle Coffee')).not.toHaveAttribute('aria-busy')
    expect(await screen.findByText('Added “Blue Bottle Coffee”.')).toBeInTheDocument()
  })

  it('closes with Back, like any other page', async () => {
    const { router } = renderApp('/transactions')
    await screen.findByRole('table')

    await router.navigate({ to: '/transactions/new', search: true })
    await screen.findByRole('dialog', { name: 'Add transaction' })
    router.history.back()

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('reopens the form with the user’s input and the server’s field errors when the API rejects it', async () => {
    server.use(
      http.post('*/api/transactions', () =>
        HttpResponse.json(
          {
            title: 'One or more validation errors occurred.',
            status: 400,
            errors: { categoryId: ['Rent is not allowed here.'] },
          },
          { status: 400 },
        ),
      ),
    )
    const { user } = renderApp('/transactions/new')
    const dialog = await screen.findByRole('dialog', { name: 'Add transaction' })

    await user.type(within(dialog).getByLabelText('Amount (USD)'), '1650')
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Rent')
    await user.type(within(dialog).getByLabelText('Description'), 'Rent — December')
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }))

    const reopened = await screen.findByRole('dialog', { name: 'Add transaction' })
    expect(within(reopened).getByLabelText('Description')).toHaveValue('Rent — December')
    expect(within(reopened).getByLabelText('Amount (USD)')).toHaveValue('1650.00')
    expect(within(reopened).getByLabelText('Category')).toHaveAccessibleDescription(
      'Rent is not allowed here.',
    )
  })
})

describe('Editing a transaction', () => {
  it('opens pre-filled from the row menu and shows the change before the server responds', async () => {
    const put = holdRequests('put')
    renderApp('/transactions')
    await screen.findByRole('table')

    const user = await openRowMenu('Sushi Ran')
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' })
    const description = await within(dialog).findByLabelText('Description')
    expect(within(dialog).getByLabelText('Amount (USD)')).toHaveValue('98.00')

    await user.clear(description)
    await user.type(description, 'Sushi Ran — team lunch')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    // Optimistic: the table shows the new description while the PUT is still in flight.
    expect(await screen.findByText('Sushi Ran — team lunch')).toBeInTheDocument()
    expect(put.bodies[0]).toMatchObject({
      description: 'Sushi Ran — team lunch',
      amount: 9800,
      version: 1,
    })

    put.open()
    expect(await screen.findByText('Saved “Sushi Ran — team lunch”.')).toBeInTheDocument()
    expect(db.find('01935a3c-0000-7000-8000-000000000001')?.version).toBe(2)
  })

  it('rolls back and explains when someone else saved first (409)', async () => {
    const sushiId = '01935a3c-0000-7000-8000-000000000001'
    renderApp('/transactions')
    await screen.findByRole('table')

    const user = await openRowMenu('Sushi Ran')
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' })
    const description = await within(dialog).findByLabelText('Description') // loaded version 1

    // While our dialog is open, someone else saves a change (version 1 → 2).
    const current = db.find(sushiId)
    if (!current) throw new Error('missing fixture')
    db.update(sushiId, { ...current, amount: 1_000 })

    await user.clear(description)
    await user.type(description, 'My stale edit')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('“Sushi Ran” was changed elsewhere, so your edit wasn’t saved.'),
    ).toBeInTheDocument()
    // The optimistic change is rolled back, and the other person's change is kept.
    await waitFor(() => {
      expect(screen.queryByText('My stale edit')).not.toBeInTheDocument()
    })
    expect(db.find(sushiId)).toMatchObject({ description: 'Sushi Ran', amount: 1_000, version: 2 })
  })

  it('opens directly from a shared link', async () => {
    renderApp('/transactions/01935a3c-0000-7000-8000-000000000002/edit')

    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' })
    expect(await within(dialog).findByLabelText('Description')).toHaveValue(
      'Payroll — Northwind Traders',
    )
    expect(within(dialog).getByRole('radio', { name: 'Income' })).toBeChecked()
  })

  it('explains when the transaction no longer exists', async () => {
    renderApp('/transactions/01935a3c-0000-7000-8000-999999999999/edit')

    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This transaction doesn’t exist.',
    )
  })
})

describe('Deleting a transaction', () => {
  it('asks for confirmation, then removes the row before the server responds', async () => {
    const del = holdRequests('delete')
    renderApp('/transactions')
    await screen.findByRole('table')

    const user = await openRowMenu('Rent — Maple Court Apartments')
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete this transaction?' })
    expect(confirm).toHaveTextContent('“Rent — Maple Court Apartments”, -$1,650.00 on Nov 1, 2026.')
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus() // safe default

    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))

    // Optimistic: gone immediately, while the DELETE is still in flight.
    await waitFor(() => {
      expect(row('Rent — Maple Court')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–2 of 2 transactions')
    expect(del.urls[0]?.searchParams.get('version')).toBe('3') // concurrency token sent

    del.open()
    expect(await screen.findByText('Deleted “Rent — Maple Court Apartments”.')).toBeInTheDocument()
    expect(row('Rent — Maple Court')).not.toBeInTheDocument()
  })

  it('puts the row back and says so when the delete fails', async () => {
    server.use(
      http.delete('*/api/transactions/:id', () =>
        HttpResponse.json({ title: 'Service unavailable', status: 503 }, { status: 503 }),
      ),
    )
    renderApp('/transactions')
    await screen.findByRole('table')

    const user = await openRowMenu('Sushi Ran')
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )

    expect(await screen.findByText('Couldn’t delete “Sushi Ran”.')).toBeInTheDocument()
    expect(row('Sushi Ran')).toBeInTheDocument()
  })

  it('does nothing when cancelled', async () => {
    const del = holdRequests('delete')
    renderApp('/transactions')
    await screen.findByRole('table')

    const user = await openRowMenu('Sushi Ran')
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(row('Sushi Ran')).toBeInTheDocument()
    expect(del.urls).toHaveLength(0)
  })
})
