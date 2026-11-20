import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEBOUNCE_MS = 300

interface SearchInputProps {
  /** The committed value, i.e. what's in the URL. */
  value: string | undefined
  /** Called after the user pauses typing. Must be referentially stable. */
  onCommit: (value: string | undefined) => void
}

/**
 * Text input that updates the URL only after typing pauses, so each keystroke
 * doesn't trigger a request and a history entry.
 */
export function SearchInput({ value, onCommit }: SearchInputProps) {
  const [text, setText] = useState(value ?? '')
  const [lastCommitted, setLastCommitted] = useState(value)
  const [lastSeenValue, setLastSeenValue] = useState(value)

  // The URL changed. If it wasn't our own debounced commit (e.g. "Clear
  // filters" or Back), show the new value. Adjusting state during render is
  // React's recommended alternative to syncing in an effect.
  if (value !== lastSeenValue) {
    setLastSeenValue(value)
    if (value !== lastCommitted) setText(value ?? '')
  }

  useEffect(() => {
    const next = text.trim() || undefined
    if (next === value) return
    const timer = setTimeout(() => {
      setLastCommitted(next)
      onCommit(next)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [text, value, onCommit])

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="transaction-search">Search</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="transaction-search"
          type="search"
          placeholder="Description…"
          className="pl-8"
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
      </div>
    </div>
  )
}
