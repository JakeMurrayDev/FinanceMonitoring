import { http, HttpResponse } from 'msw'

import type { TransactionItem } from '@/api/types'

import { budgetDb } from './budgets'
import { mockCategories, pageOf } from './data'
import { db } from './db'

type Body = Omit<TransactionItem, 'id' | 'categoryName' | 'version'> & { version?: number }

const notFound = () => HttpResponse.json({ title: 'Not Found', status: 404 }, { status: 404 })
const conflict = () =>
  HttpResponse.json(
    { title: 'This transaction was changed by someone else.', status: 409 },
    { status: 409 },
  )

/**
 * Default handlers: a happy-path API backed by the in-memory `db`. Tests
 * override them with `server.use()` for errors, delays, or to inspect
 * requests. MSW mocks at the network level, so the real client, query and
 * component code all run.
 */
export const handlers = [
  http.get('*/api/categories', () => HttpResponse.json({ categories: mockCategories })),

  http.get('*/api/transactions', ({ request }) => {
    const params = new URL(request.url).searchParams
    const page = Number(params.get('page') ?? 1)
    const pageSize = Number(params.get('pageSize') ?? 25)
    const type = params.get('type')
    const items = db.all().filter((row) => !type || row.type === type)
    return HttpResponse.json(
      pageOf(items.slice((page - 1) * pageSize, page * pageSize), {
        page,
        pageSize,
        totalCount: items.length,
      }),
    )
  }),

  http.get('*/api/transactions/:id', ({ params }) => {
    const row = db.find(String(params.id))
    return row ? HttpResponse.json(row) : notFound()
  }),

  http.post('*/api/transactions', async ({ request }) => {
    const body = (await request.json()) as Body
    return HttpResponse.json(db.insert(body), { status: 201 })
  }),

  http.put('*/api/transactions/:id', async ({ request, params }) => {
    const body = (await request.json()) as Body & { version: number }
    const result = db.update(String(params.id), body)
    if (result === undefined) return notFound()
    if (result === 'conflict') return conflict()
    return HttpResponse.json(result)
  }),

  http.get('*/api/budgets', ({ request }) => {
    const month = new URL(request.url).searchParams.get('month') ?? '2026-11'
    return HttpResponse.json(budgetDb.month(month))
  }),

  http.put('*/api/budgets/:categoryId', async ({ request, params }) => {
    const body = (await request.json()) as { month: string; amount: number; version: number | null }
    const result = budgetDb.change(String(params.categoryId), body.month, body.amount, body.version)
    if (result === undefined) return notFound()
    if (result === 'conflict') return conflict()
    return HttpResponse.json(result)
  }),

  http.delete('*/api/budgets/:categoryId', ({ request, params }) => {
    const query = new URL(request.url).searchParams
    const version = query.get('version')
    const result = budgetDb.change(
      String(params.categoryId),
      query.get('month') ?? '',
      null,
      version === null ? null : Number(version),
    )
    if (result === undefined) return notFound()
    if (result === 'conflict') return conflict()
    return HttpResponse.json(result)
  }),

  http.delete('*/api/transactions/:id', ({ request, params }) => {
    const version = Number(new URL(request.url).searchParams.get('version'))
    const result = db.remove(String(params.id), version)
    if (result === undefined) return notFound()
    if (result === 'conflict') return conflict()
    return new HttpResponse(null, { status: 204 })
  }),
]
