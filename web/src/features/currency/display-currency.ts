import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'finance-monitor:display-currency'
const CODE = /^[A-Z]{3}$/
export const ACCOUNT_CURRENCY = 'USD'

const listeners = new Set<() => void>()

/**
 * The user's display currency: a personal preference rather than part of the
 * page's state, so it lives in localStorage and survives reloads. Storage can
 * throw (private browsing, blocked cookies); every access falls back to USD.
 */
export function getDisplayCurrency(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && CODE.test(stored) ? stored : ACCOUNT_CURRENCY
  } catch {
    return ACCOUNT_CURRENCY
  }
}

export function setDisplayCurrency(code: string) {
  try {
    if (code === ACCOUNT_CURRENCY) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Not persisted, but still applied for this session via the listeners below.
    sessionFallback = code
  }
  for (const listener of listeners) listener()
}

let sessionFallback: string | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener() // another tab changed it
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const snapshot = () => sessionFallback ?? getDisplayCurrency()

export function useDisplayCurrency(): [string, (code: string) => void] {
  return [useSyncExternalStore(subscribe, snapshot, () => ACCOUNT_CURRENCY), setDisplayCurrency]
}
