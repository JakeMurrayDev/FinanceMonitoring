import { useQuery } from '@tanstack/react-query'

import { NativeSelect } from '@/components/form/NativeSelect'
import { Label } from '@/components/ui/label'

import { ACCOUNT_CURRENCY, useDisplayCurrency } from '../display-currency'
import { currenciesQueryOptions } from '../queries'

/** In the app header: one setting for every page, remembered across reloads. */
export function CurrencyPicker() {
  const [value, setValue] = useDisplayCurrency()
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
        className="w-48"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
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
