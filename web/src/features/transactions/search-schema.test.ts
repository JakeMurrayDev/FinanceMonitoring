import { describe, expect, it } from 'vitest'

import { dateRangeError, hasActiveFilters, transactionSearchSchema } from './search-schema'

const parse = (input: Record<string, unknown>) => transactionSearchSchema.parse(input)

describe('transactionSearchSchema', () => {
  it('fills in defaults for an empty URL', () => {
    expect(parse({})).toEqual({ sort: 'Date', dir: 'Desc', page: 1, pageSize: 25 })
  })

  it('parses the string values that come from the URL', () => {
    expect(
      parse({
        search: '  coffee ',
        type: 'Expense',
        category: ['dining', 'groceries'],
        from: '2026-06-01',
        to: '2026-11-20',
        sort: 'Amount',
        dir: 'Asc',
        page: '3',
        pageSize: '50',
      }),
    ).toEqual({
      search: 'coffee',
      type: 'Expense',
      category: ['dining', 'groceries'],
      from: '2026-06-01',
      to: '2026-11-20',
      sort: 'Amount',
      dir: 'Asc',
      page: 3,
      pageSize: 50,
    })
  })

  it('accepts typed values from navigate()', () => {
    expect(parse({ page: 2, pageSize: 10 })).toMatchObject({ page: 2, pageSize: 10 })
  })

  it('turns a single category into an array', () => {
    expect(parse({ category: 'dining' }).category).toEqual(['dining'])
  })

  it.each([
    ['page', 'abc', 1],
    ['page', '0', 1],
    ['page', '1.5', 1],
    ['pageSize', '7', 25],
    ['pageSize', '1000', 25],
    ['sort', 'Bogus', 'Date'],
    ['dir', 'sideways', 'Desc'],
  ])('falls back to the default when %s is %j', (key, value, expected) => {
    expect(parse({ [key]: value })[key as 'page']).toBe(expected)
  })

  it.each([
    ['type', 'income'], // case-sensitive, like the API
    ['from', '2026-13-45'],
    ['to', 'yesterday'],
    ['search', 'x'.repeat(101)],
  ])('drops an invalid %s (%j) instead of failing', (key, value) => {
    expect(parse({ [key]: value })[key as 'type']).toBeUndefined()
  })

  it('removes malformed category ids but keeps valid ones', () => {
    expect(parse({ category: ['dining', 'DROP TABLE', 'groceries'] }).category).toEqual([
      'dining',
      'groceries',
    ])
  })
})

describe('hasActiveFilters', () => {
  it('ignores sort and paging', () => {
    expect(hasActiveFilters(parse({ sort: 'Amount', page: '4' }))).toBe(false)
  })

  it.each([{ search: 'x' }, { type: 'Income' }, { category: 'rent' }, { from: '2026-01-01' }])(
    'is true when %o is set',
    (filter) => {
      expect(hasActiveFilters(parse(filter))).toBe(true)
    },
  )
})

describe('dateRangeError', () => {
  it('flags a reversed range only', () => {
    expect(dateRangeError({ from: '2026-03-01', to: '2026-02-01' })).toMatch(/start date/)
    expect(dateRangeError({ from: '2026-02-01', to: '2026-02-01' })).toBeUndefined()
    expect(dateRangeError({ from: '2026-02-01' })).toBeUndefined()
  })
})
