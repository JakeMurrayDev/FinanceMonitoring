import { vi } from 'vitest'

/** Make min-width media queries fail, as on a phone. Undo with vi.restoreAllMocks(). */
export function mockPhoneViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}
