import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { TrendPoint } from '@/api/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMonth } from '@/lib/months'

import { formatAmount, summariseTrend } from '../insights'
import { ChartCard } from './ChartCard'
import { axisTick, chartColors, compactMoney, MAX_BAR } from './chart-theme'
import { ChartTooltip } from './ChartTooltip'

const shortMonth = (month: string) => formatMonth(month).slice(0, 3)
const SERIES_ORDER = ['Income', 'Expenses', 'Net']

/**
 * Income and expenses as columns, net as a line: three series on ONE axis
 * (all in the same currency). Series are told apart by legend, shape (bar vs
 * line) and a CVD-validated colour pair, not by colour alone.
 */
export function MonthlyTrend({
  points,
  currency,
}: {
  points: readonly TrendPoint[]
  currency: string
}) {
  const summary = summariseTrend(points, currency)

  return (
    <ChartCard
      title="Six-month trend"
      summary={summary}
      chart={
        <ResponsiveContainer
          width="100%"
          height={300}
          initialDimension={{ width: 600, height: 300 }}
        >
          <ComposedChart
            data={[...points]}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            barGap={2}
            desc={summary}
          >
            <CartesianGrid vertical={false} stroke={chartColors.grid} strokeWidth={1} />
            <XAxis
              dataKey="month"
              tickFormatter={shortMonth}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: chartColors.grid }}
            />
            <YAxis
              tickFormatter={(value: number) => compactMoney(value, currency)}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: chartColors.muted, strokeWidth: 1 }}
              content={<ChartTooltip currency={currency} formatLabel={formatMonth} />}
            />
            <Legend
              iconSize={10}
              // Keep the series order (Income, Expenses, Net), not alphabetical.
              itemSorter={(item) => SERIES_ORDER.indexOf(String(item.value))}
              // Legend text stays in text ink; the swatch beside it carries the colour.
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            <Bar
              dataKey="income"
              name="Income"
              fill={chartColors.series1}
              maxBarSize={MAX_BAR}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              fill={chartColors.series2}
              maxBarSize={MAX_BAR}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              dataKey="net"
              name="Net"
              // Straight segments: monthly totals have nothing "between" months to interpolate.
              type="linear"
              stroke={chartColors.ink}
              strokeWidth={2}
              dot={{ r: 4, fill: chartColors.ink, stroke: chartColors.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: chartColors.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={point.month}>
                <TableCell>{formatMonth(point.month)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(point.income, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(point.expenses, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(point.net, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  )
}
