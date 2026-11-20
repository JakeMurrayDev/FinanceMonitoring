const mediumDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

/**
 * Format a calendar date ("2026-11-18") for display ("Nov 18, 2026").
 *
 * The date is pinned to UTC on both sides: `new Date('2026-11-18')` is UTC
 * midnight, and formatting it in a US time zone would otherwise show Nov 17.
 */
export function formatIsoDate(isoDate: string): string {
  return mediumDate.format(new Date(`${isoDate}T00:00:00Z`))
}
