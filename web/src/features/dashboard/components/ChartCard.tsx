import { BarChart3, Table2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ChartCardProps {
  title: string
  /** One-sentence takeaway; also the chart's accessible description. */
  summary: string
  chart: ReactNode
  table: ReactNode
}

/**
 * A chart with a text summary and a table view of the same numbers. The table
 * is the accessible equivalent: every value is readable without the chart,
 * its colours, or a hover tooltip.
 */
export function ChartCard({ title, summary, chart, table }: ChartCardProps) {
  const id = useId()
  const [showTable, setShowTable] = useState(false)

  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`${id}-title`} className="font-semibold">
            {title}
          </h2>
          <p id={`${id}-summary`} className="text-sm text-muted-foreground">
            {summary}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={showTable}
          onClick={() => {
            setShowTable((value) => !value)
          }}
        >
          {showTable ? <BarChart3 aria-hidden="true" /> : <Table2 aria-hidden="true" />}
          {showTable ? 'Show chart' : 'Show table'}
        </Button>
      </div>
      {showTable ? table : chart}
    </section>
  )
}
