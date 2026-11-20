import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { DemoBanner } from './DemoBanner'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('ThemeToggle', () => {
  it('switches to dark, applies it to <html>, and remembers it', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Theme: System' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('finance-monitor:theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument()
  })

  it('follows the system setting by default and when chosen', async () => {
    const user = userEvent.setup()
    localStorage.setItem('finance-monitor:theme', 'dark')
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Theme: Dark' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'System' }))

    expect(document.documentElement).not.toHaveClass('dark') // the test "system" prefers light
    expect(localStorage.getItem('finance-monitor:theme')).toBeNull()
  })
})

describe('DemoBanner', () => {
  it('explains that demo data resets, only on the demo', () => {
    const { rerender } = render(<DemoBanner enabled />)
    expect(screen.getByText(/everything resets to fresh sample data/)).toBeInTheDocument()

    rerender(<DemoBanner enabled={false} />)
    expect(screen.queryByText(/everything resets/)).not.toBeInTheDocument()
  })
})
