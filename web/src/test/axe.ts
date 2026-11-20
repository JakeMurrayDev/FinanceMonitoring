import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Run axe-core against the rendered DOM and fail with a readable list of
 * violations. Colour contrast is skipped: jsdom has no layout or computed
 * colours, so contrast is checked by measuring the theme tokens instead.
 */
export async function expectNoAxeViolations(root: Element = document.body) {
  const results = await axe.run(root, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  })
  const report = results.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? 'n/a'}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  )
  expect(report, report.join('\n\n')).toEqual([])
}
