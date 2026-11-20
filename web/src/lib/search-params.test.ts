import { describe, expect, it } from 'vitest'

import { parseSearch, stringifySearch } from './search-params'

describe('parseSearch', () => {
  it('returns single values as strings and repeated keys as arrays', () => {
    expect(parseSearch('?type=Expense&category=dining&category=groceries&page=2')).toEqual({
      type: 'Expense',
      category: ['dining', 'groceries'],
      page: '2',
    })
  })

  it('decodes encoded characters', () => {
    expect(parseSearch('?search=100%25%20organic')).toEqual({ search: '100% organic' })
  })

  it('returns an empty object for no query', () => {
    expect(parseSearch('')).toEqual({})
  })
})

describe('stringifySearch', () => {
  it('writes arrays as repeated keys and skips empty values', () => {
    expect(
      stringifySearch({
        type: 'Expense',
        category: ['dining', 'groceries'],
        page: 2,
        search: '',
        from: undefined,
      }),
    ).toBe('?type=Expense&category=dining&category=groceries&page=2')
  })

  it('returns an empty string when nothing is set', () => {
    expect(stringifySearch({ category: [], search: undefined })).toBe('')
  })

  it('round-trips with parseSearch', () => {
    const query = '?search=caf%C3%A9&category=a&category=b'
    expect(stringifySearch(parseSearch(query))).toBe(query)
  })
})
