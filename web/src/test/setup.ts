// Adds DOM matchers like `toBeInTheDocument()` and `toHaveAccessibleName()` to `expect`.
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { budgetDb } from '@/mocks/budgets'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'

// jsdom doesn't implement scrolling; the router's scroll restoration calls it.
vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

// jsdom has no layout engine, so no ResizeObserver; Radix components measure
// themselves with it. A no-op is enough: tests don't depend on element sizes.
globalThis.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

// jsdom has no matchMedia. Emulate a light-themed desktop: min-width
// queries match (tests opt into phone layouts with mockViewport) and
// prefers-color-scheme: dark doesn't.
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})

// Fail loudly on any request without a handler, rather than hitting the network.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  localStorage.clear() // display-currency preference
  // Testing Library only auto-unmounts when Vitest `globals` is on; we import
  // `describe`/`it` explicitly instead, so unmount rendered trees here.
  cleanup()
  server.resetHandlers()
  db.reset()
  budgetDb.reset()
})

afterAll(() => {
  server.close()
})
