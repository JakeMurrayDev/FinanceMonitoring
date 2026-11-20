// Adds DOM matchers like `toBeInTheDocument()` and `toHaveAccessibleName()` to `expect`.
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom doesn't implement scrolling; the router's scroll restoration calls it.
vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

// Testing Library only auto-unmounts when Vitest `globals` is on. We import
// `describe`/`it` explicitly instead, so unmount rendered trees here.
afterEach(() => {
  cleanup()
})
