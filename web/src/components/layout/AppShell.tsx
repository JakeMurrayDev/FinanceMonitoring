import { Link } from '@tanstack/react-router'
import { LayoutDashboard, PiggyBank, ReceiptText, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* First focusable element: lets keyboard users jump past the nav. */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to main content
      </a>

      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Wallet aria-hidden="true" className="size-5" />
            Finance Monitor
          </Link>

          <nav aria-label="Main">
            <ul className="flex gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  {/* Link sets aria-current="page" on the active route; we style off that. */}
                  <Link
                    to={to}
                    activeOptions={{ exact: to === '/' }}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none">
        {children}
      </main>
    </div>
  )
}
