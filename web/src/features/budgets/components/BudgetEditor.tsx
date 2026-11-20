import { useEffect, useId, useRef, useState } from 'react'

import type { BudgetLine } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { money, parseMoney, toDecimalString, type ParseMoneyError } from '@/lib/money'
import { formatMonth } from '@/lib/months'

const MESSAGES: Record<ParseMoneyError, string> = {
  EMPTY: 'Enter a budget.',
  INVALID_FORMAT: 'Enter an amount like 400.00.',
  TOO_MANY_DECIMALS: 'Use at most 2 decimal places.',
  OUT_OF_RANGE: 'That amount is too large.',
}

interface BudgetEditorProps {
  line: BudgetLine
  month: string
  onSave: (amount: number) => void
  onCancel: () => void
}

/** Inline amount editor. Parses with parseMoney (no floats); Escape cancels. */
export function BudgetEditor({ line, month, onSave, onCancel }: BudgetEditorProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(
    line.budget === null ? '' : toDecimalString(money(line.budget, 'USD')),
  )
  const [error, setError] = useState<string>()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const parsed = parseMoney(text, 'USD')
    if (!parsed.ok) {
      setError(MESSAGES[parsed.error])
    } else if (parsed.value.amount <= 0) {
      setError('Enter a budget greater than zero.')
    } else {
      onSave(parsed.value.amount)
    }
    inputRef.current?.focus()
  }

  return (
    <form
      noValidate
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Label htmlFor={id}>Monthly budget for {line.categoryName}</Label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
        >
          $
        </span>
        <Input
          ref={inputRef}
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pl-6 font-mono tabular-nums"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error ${id}-hint` : `${id}-hint`}
          onChange={(event) => {
            setText(event.target.value)
            setError(undefined)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancel()
          }}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Applies from {formatMonth(month)} onward. Earlier months keep their budget.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
