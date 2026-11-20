import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form'

import type { Category } from '@/api/types'
import { NativeSelect } from '@/components/form/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { todayIsoDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

import {
  createTransactionFormSchema,
  emptyFormInput,
  type TransactionFormInput,
  type TransactionFormValues,
} from '../form-schema'
import { TRANSACTION_TYPES } from '../search-schema'

type FieldName = FieldPath<TransactionFormInput>
const FIELD_NAMES: readonly FieldName[] = ['type', 'amount', 'date', 'categoryId', 'description']

export interface TransactionFormProps {
  categories: readonly Category[] | undefined
  defaultValues?: TransactionFormInput
  /** Field errors returned by the API (400), keyed by field name. */
  serverErrors?: Record<string, string[] | undefined>
  submitLabel: string
  onSubmit: (values: TransactionFormValues) => void
  onCancel: () => void
  /** Injected in tests; defaults to the user's local date. */
  today?: string
}

export function TransactionForm({
  categories = [],
  defaultValues,
  serverErrors,
  submitLabel,
  onSubmit,
  onCancel,
  today = todayIsoDate(),
}: TransactionFormProps) {
  const schema = useMemo(() => createTransactionFormSchema(today), [today])
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? emptyFormInput(today),
    // Validate on submit first, then live as the user fixes each field.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const { register, control, handleSubmit, setValue, getValues, setError, formState } = form
  const { errors } = formState

  // Show errors the server reported (e.g. a rule the client couldn't check).
  useEffect(() => {
    if (!serverErrors) return
    for (const [key, messages] of Object.entries(serverErrors)) {
      const field = FIELD_NAMES.find((name) => name === key)
      if (field && messages?.[0])
        setError(field, { type: 'server', message: messages[0] }, { shouldFocus: true })
    }
  }, [serverErrors, setError])

  const type = useWatch({ control, name: 'type' })
  const categoryOptions = categories.filter((c) => c.type === type)

  const errorProps = (field: FieldName) =>
    errors[field] ? { 'aria-invalid': true as const, 'aria-describedby': `${field}-error` } : {}

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">Type</legend>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              ref={field.ref}
              value={field.value}
              onValueChange={(value) => {
                const next = TRANSACTION_TYPES.find((t) => t === value)
                if (!next) return
                field.onChange(next)
                // A category belongs to one type; clear it if it no longer fits.
                const current = categories.find((c) => c.id === getValues('categoryId'))
                if (current && current.type !== next) setValue('categoryId', '')
              }}
              className="grid grid-cols-2 gap-2"
            >
              {TRANSACTION_TYPES.map((option) => (
                <Label
                  key={option}
                  htmlFor={`type-${option}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 font-normal',
                    'has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent',
                  )}
                >
                  <RadioGroupItem id={`type-${option}`} value={option} />
                  {option}
                </Label>
              ))}
            </RadioGroup>
          )}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="amount" label="Amount (USD)" error={errors.amount?.message}>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
              $
            </span>
            <Input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              className="pl-6 font-mono tabular-nums"
              {...errorProps('amount')}
              {...register('amount')}
            />
          </div>
        </Field>

        <Field id="date" label="Date" error={errors.date?.message}>
          <Input id="date" type="date" max={today} {...errorProps('date')} {...register('date')} />
        </Field>
      </div>

      <Field id="categoryId" label="Category" error={errors.categoryId?.message}>
        <NativeSelect id="categoryId" {...errorProps('categoryId')} {...register('categoryId')}>
          <option value="">Choose a category</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field id="description" label="Description" error={errors.description?.message}>
        <Input
          id="description"
          autoComplete="off"
          placeholder="e.g. Trader Joe's"
          {...errorProps('description')}
          {...register('description')}
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error: string | undefined
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
