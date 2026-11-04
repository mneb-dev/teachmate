import { CircleCheck, CircleX } from 'lucide-react'
import {
  checkTosTable,
  distributionColumns,
  itemPlacement,
  rowPercents,
  tableMatchesShape,
  totalHours,
  type TosCheck,
  type TosInputs,
  type TosTable,
} from '@shared/tos'
import { cn } from '@renderer/lib/cn'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))
const fmt = (h: number) => String(Number(h.toFixed(2)))

function Status({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <CircleCheck className="inline size-3.5 text-success" aria-label={`${label} correct`} />
  ) : (
    <CircleX className="inline size-3.5 text-primary" aria-label={`${label} does not match`} />
  )
}

/** The TOS grid: editable cells with live row, column and grand-total checks. */
export function TosTableEditor({
  inputs,
  table,
  onCellChange,
}: {
  inputs: TosInputs
  table: TosTable
  onCellChange: (row: number, column: number, value: number) => void
}) {
  if (!tableMatchesShape(inputs, table)) return null
  const columns = distributionColumns(table.mode)
  const check: TosCheck = checkTosTable(inputs, table)
  const percents = rowPercents(inputs)
  const placement = itemPlacement(table)

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[42rem] border-collapse text-sm"
        aria-label="Table of specifications"
      >
        <thead>
          <tr className="border-b border-border bg-surface-muted/60 text-xs text-muted-foreground">
            <th scope="col" className="px-2 py-2 text-left font-medium">
              #
            </th>
            <th scope="col" className="px-2 py-2 text-left font-medium">
              Learning competency
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Hours
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              %
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Items
            </th>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className="px-2 py-2 text-center font-medium"
                title={c.label}
              >
                {c.label}
              </th>
            ))}
            <th scope="col" className="px-2 py-2 text-center font-medium">
              Row total
            </th>
          </tr>
        </thead>
        <tbody>
          {inputs.competencies.map((c, i) => {
            const rowOk = check.rowErrors[i] === null
            return (
              <tr key={c.id} className="border-b border-border align-top" data-role="tos-row">
                <td className="px-2 py-2 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="max-w-64 px-2 py-2">
                  <span
                    className={cn(
                      'line-clamp-3',
                      !c.competency.trim() && 'text-muted-foreground italic',
                    )}
                  >
                    {c.competency.trim() || 'Untitled competency'}
                  </span>
                  {c.code.trim() && (
                    <span className="font-mono text-xs text-muted-foreground">{c.code.trim()}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(c.hours)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{percents[i].toFixed(2)}</td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">
                  {check.rowTargets[i]}
                </td>
                {table.rows[i].cells.map((value, j) => (
                  <td key={j} className="px-1 py-1.5 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={value}
                      onChange={(ev) => onCellChange(i, j, toInt(ev.target.value))}
                      aria-label={`Items for competency ${i + 1}, ${columns[j].label}`}
                      className={cn(
                        'h-8 w-14 rounded-md border bg-surface text-center tabular-nums focus:border-primary/60 focus:outline-none',
                        rowOk && check.columnErrors[j] === null
                          ? 'border-border'
                          : 'border-primary/60',
                      )}
                    />
                    {value > 0 && (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground tabular-nums">
                        {placement[i][j]}
                      </span>
                    )}
                  </td>
                ))}
                <td
                  className="px-2 py-2 text-center tabular-nums"
                  title={check.rowErrors[i] ?? undefined}
                >
                  <span className={cn('font-medium', !rowOk && 'text-primary')}>
                    {check.rowTotals[i]}
                    {!rowOk && ` / ${check.rowTargets[i]}`}
                  </span>{' '}
                  <Status ok={rowOk} label={`Row ${i + 1}`} />
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface-muted/60 font-medium" data-role="tos-totals">
            <td />
            <td className="px-2 py-2">Total</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totalHours(inputs))}</td>
            <td className="px-2 py-2 text-right tabular-nums">100.00</td>
            <td className="px-2 py-2 text-right tabular-nums">{inputs.totalItems}</td>
            {check.columnTotals.map((t, j) => {
              const ok = check.columnErrors[j] === null
              return (
                <td
                  key={j}
                  className="px-2 py-2 text-center tabular-nums"
                  title={check.columnErrors[j] ?? undefined}
                >
                  <span className={cn(!ok && 'text-primary')}>
                    {t}
                    {!ok && ` / ${check.columnTargets[j]}`}
                  </span>{' '}
                  <Status ok={ok} label={`${columns[j].label} column`} />
                </td>
              )
            })}
            <td className="px-2 py-2 text-center tabular-nums">
              <span className={cn(check.grandTotal !== inputs.totalItems && 'text-primary')}>
                {check.grandTotal}
              </span>{' '}
              <Status ok={check.grandTotal === inputs.totalItems} label="Grand total" />
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Small numbers under each cell are item numbers (easiest level first). Edit any cell — row
        and column totals are checked as you type.
      </p>
    </div>
  )
}
