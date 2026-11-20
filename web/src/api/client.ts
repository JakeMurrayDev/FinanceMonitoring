import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'

/**
 * Typed HTTP client generated from the API's OpenAPI document. Paths, query
 * parameters and response bodies are all checked against the C# contract.
 */
export const api = createClient<paths>({
  // Absolute URL so requests also work under Node (tests), where relative
  // URLs can't be resolved. In the browser this is the Vite/Vercel origin,
  // which proxies /api to the .NET service.
  baseUrl: globalThis.location.origin,
  // Look fetch up at call time so interceptors installed later (MSW in tests) apply.
  fetch: (request) => globalThis.fetch(request),
})

export type ProblemDetails = components['schemas']['HttpValidationProblemDetails']

/** A non-2xx response from the API, carrying its RFC 9457 problem details. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails | undefined

  constructor(status: number, problem: ProblemDetails | undefined) {
    super(problem?.title ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

/** Return the data of a successful response, or throw an {@link ApiError}. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    throw new ApiError(result.response.status, result.error as ProblemDetails | undefined)
  }
  return result.data
}
