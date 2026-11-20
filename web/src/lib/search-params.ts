/**
 * URL search-param (de)serialisation for TanStack Router.
 *
 * The router's default writes arrays and objects as JSON
 * (`?category=%5B%22dining%22%5D`). These versions use plain repeated keys
 * (`?category=dining&category=groceries`), which is readable, easy to share,
 * and the same format the .NET API accepts. Every value is parsed as a string;
 * each route's Zod schema turns strings into numbers, enums, etc.
 */

export type RawSearch = Record<string, string | string[]>

export function parseSearch(searchString: string): RawSearch {
  const params = new URLSearchParams(searchString)
  const result: RawSearch = {}
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key)
    result[key] = values.length === 1 ? (values[0] ?? '') : values
  }
  return result
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === '') continue
      params.append(key, String(item))
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
