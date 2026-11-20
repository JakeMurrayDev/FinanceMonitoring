/**
 * Months as "yyyy-MM" strings, the same format the API uses. Pure string and
 * integer arithmetic, so no Date time-zone surprises.
 */

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function isMonth(value: string): boolean {
  return MONTH_PATTERN.test(value) && Number(value.slice(0, 4)) > 0
}

/** The user's current local month. */
export function currentMonth(now: Date = new Date()): string {
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, '0')}`
}

const monthName = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "2026-11" → "November 2026" */
export function formatMonth(month: string): string {
  return monthName.format(new Date(`${month}-01T00:00:00Z`))
}
