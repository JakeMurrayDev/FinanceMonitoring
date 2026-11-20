import { ChevronDown } from 'lucide-react'
import { useId } from 'react'

import type { Category } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface CategoryFilterProps {
  categories: readonly Category[] | undefined
  selected: readonly string[]
  onChange: (selected: string[] | undefined) => void
}

/** Multi-select of categories: a popover containing a grouped checkbox list. */
export function CategoryFilter({ categories = [], selected, onChange }: CategoryFilterProps) {
  const labelId = useId()

  const toggle = (id: string, checked: boolean) => {
    const next = checked ? [...selected, id] : selected.filter((s) => s !== id)
    onChange(next.length ? next : undefined)
  }

  const groups = [
    { title: 'Expenses', items: categories.filter((c) => c.type === 'Expense') },
    { title: 'Income', items: categories.filter((c) => c.type === 'Income') },
  ]

  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-sm leading-none font-medium">
        Categories
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-labelledby={labelId}
            aria-describedby={`${labelId}-summary`}
            className="w-full justify-between font-normal"
          >
            <span id={`${labelId}-summary`}>
              {selected.length === 0 ? 'All categories' : `${selected.length} selected`}
            </span>
            <ChevronDown aria-hidden="true" className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <div className="max-h-80 overflow-y-auto p-3">
            {groups.map((group) =>
              group.items.length ? (
                <fieldset key={group.title} className="mb-3 last:mb-0">
                  <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </legend>
                  <ul className="grid gap-2">
                    {group.items.map((category) => {
                      const id = `${labelId}-${category.id}`
                      return (
                        <li key={category.id} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={selected.includes(category.id)}
                            onCheckedChange={(checked) => {
                              toggle(category.id, checked === true)
                            }}
                          />
                          <Label htmlFor={id} className="font-normal">
                            {category.name}
                          </Label>
                        </li>
                      )
                    })}
                  </ul>
                </fieldset>
              ) : null,
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange(undefined)
                }}
              >
                Clear categories <Badge variant="secondary">{selected.length}</Badge>
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
