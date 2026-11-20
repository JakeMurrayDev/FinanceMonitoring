import type { TooltipContentProps } from 'recharts'

import { formatAmount } from '../insights'

/**
 * Shared tooltip: value first (strong), series name second, keyed by a short
 * line in the series colour. Every series at that point is listed, so the
 * pointer never has to land on a specific mark.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  currency,
  formatLabel,
}: Partial<TooltipContentProps<number, string>> & {
  currency: string
  formatLabel?: (label: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="grid gap-1 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {label !== undefined && (
        <p className="text-xs text-muted-foreground">
          {formatLabel ? formatLabel(String(label)) : String(label)}
        </p>
      )}
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0.5 w-3 rounded-full"
            style={{ background: entry.color }}
          />
          <strong className="tabular-nums">{formatAmount(Number(entry.value), currency)}</strong>
          <span className="text-muted-foreground">{entry.name}</span>
        </p>
      ))}
    </div>
  )
}
