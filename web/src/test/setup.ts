// Adds DOM matchers like `toBeInTheDocument()` and `toHaveAccessibleName()` to `expect`.
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { server } from '@/mocks/server'

// jsdom doesn't implement scrolling; the router's scroll restoration calls it.
vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

// Fail loudly on any request without a handler, rather than hitting the network.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  // Testing Library only auto-unmounts when Vitest `globals` is on; we import
  // `describe`/`it` explicitly instead, so unmount rendered trees here.
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
