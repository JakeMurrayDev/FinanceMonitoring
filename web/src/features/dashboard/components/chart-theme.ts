/**
 * Chart styling from the theme tokens, so charts follow light/dark mode.
 * Marks follow the dataviz specs: bars ≤ 24px with 4px rounded data-ends,
 * 2px lines, ≥ 8px dots with a 2px surface ring, hairline solid grid.
 */
export const chartColors = {
  series1: 'var(--color-series-1)',
  series2: 'var(--color-series-2)',
  ink: 'var(--color-foreground)',
  muted: 'var(--color-muted-foreground)',
  grid: 'var(--color-border)',
  surface: 'var(--color-card)',
} as const

export const MAX_BAR = 24

export const axisTick = { fill: chartColors.muted, fontSize: 12 }

/** Compact axis ticks ("€1.2K"). Display-only, so dividing to major units is fine here. */
export function compactMoney(minor: number, currency: string) {
  const digits =
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(minor / 10 ** digits)
}
