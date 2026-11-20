import { useQuery } from '@tanstack/react-query'

import { NativeSelect } from '@/components/form/NativeSelect'
import { Label } from '@/components/ui/label'

import { ACCOUNT_CURRENCY } from '../display-currency'
import { currenciesQueryOptions } from '../queries'

export function CurrencyPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (code: string) => void
}) {
  const currencies = useQuery(currenciesQueryOptions())
  // If the list can't load, still offer USD and keep whatever is selected.
  const options = currencies.data ?? [{ code: ACCOUNT_CURRENCY, name: 'US Dollar' }]
  const withSelected = options.some((c) => c.code === value)
    ? options
    : [...options, { code: value, name: value }]

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="display-currency" className="whitespace-nowrap">
        Display currency
      </Label>
      <NativeSelect
        id="display-currency"
        className="w-56"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      >
        {withSelected.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.code} — {currency.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
