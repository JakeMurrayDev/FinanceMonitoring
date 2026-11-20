import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { CategorySpend } from '@/api/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { formatAmount, summariseCategories, topCategories } from '../insights'
import { ChartCard } from './ChartCard'
import { axisTick, chartColors, MAX_BAR } from './chart-theme'
import { ChartTooltip } from './ChartTooltip'

const ROW_HEIGHT = 40

export function SpendingByCategory({
  items,
  currency,
}: {
  items: readonly CategorySpend[]
  currency: string
}) {
  const rows = topCategories(items)
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const summary = summariseCategories(items, currency)

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Spending by category</h2>
        <p className="mt-2 text-sm text-muted-foreground">No spending this month.</p>
      </section>
    )
  }

  return (
    <ChartCard
      title="Spending by category"
      summary={summary}
      chart={
        // One series, so one colour for every bar (a value-ramp would double-encode length).
        <ResponsiveContainer
          width="100%"
          height={rows.length * ROW_HEIGHT + 16}
          initialDimension={{ width: 600, height: 300 }}
        >
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 96, bottom: 0, left: 0 }}
            desc={summary}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: chartColors.grid, fillOpacity: 0.4 }}
              content={<ChartTooltip currency={currency} />}
            />
            <Bar
              dataKey="amount"
              name="Spent"
              fill={chartColors.series1}
              maxBarSize={MAX_BAR}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              {/* Value at the bar tip, in text ink, never the series colour. */}
              <LabelList
                dataKey="amount"
                position="right"
                fill={chartColors.ink}
                fontSize={12}
                formatter={(value: unknown) => formatAmount(Number(value), currency)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.categoryId}>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(row.amount, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Math.round((row.amount * 100) / total)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  )
}
