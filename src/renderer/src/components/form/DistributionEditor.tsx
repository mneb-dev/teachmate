import { DISTRIBUTION_PRESETS, type BloomDistribution, type BloomMode } from '@shared/teaching'
import {
  distributionColumns,
  distributionCounts,
  distributionPercents,
  withDistributionPercents,
} from '@shared/tos'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import { cn } from '@renderer/lib/cn'
import { controlClasses } from './styles'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

/**
 * Edit a Bloom's distribution as percentages: three grouped columns
 * (Remembering + Understanding, Applying + Analyzing, Evaluating + Creating)
 * or all six levels. Shows the resulting item counts when `itemCount` is given.
 */
export function DistributionEditor({
  idPrefix,
  value,
  onChange,
  itemCount,
  invalid,
  disabled,
}: {
  idPrefix: string
  value: BloomDistribution
  onChange: (value: BloomDistribution) => void
  itemCount?: number
  invalid?: boolean
  disabled?: boolean
}) {
  const columns = distributionColumns(value.mode)
  const percents = distributionPercents(value)
  const total = percents.reduce((a, b) => a + b, 0)
  const counts =
    itemCount && itemCount > 0 && total === 100 ? distributionCounts(itemCount, value) : null

  const setPercent = (index: number, v: number) => {
    const next = [...percents]
    next[index] = v
    onChange(withDistributionPercents(value, next))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<BloomMode>
          label="Distribution type"
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
          options={[
            { value: 'grouped', label: 'Grouped' },
            { value: 'levels', label: 'All six levels' },
          ]}
        />
        <div className="flex flex-wrap gap-1">
          {DISTRIBUTION_PRESETS[value.mode].map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(withDistributionPercents(value, p.values))}
              className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('grid gap-2', value.mode === 'grouped' ? 'grid-cols-1' : 'grid-cols-2')}>
        {columns.map((c, j) => {
          const id = `${idPrefix}-${c.id}`
          return (
            <div key={c.id} className="flex items-center gap-2">
              <label htmlFor={id} className="min-w-0 flex-1 text-sm">
                {c.label}
                {value.mode === 'grouped' && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({c.short.toLowerCase()})
                  </span>
                )}
              </label>
              <div className="relative w-20 shrink-0">
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  disabled={disabled}
                  value={Number.isFinite(percents[j]) ? percents[j] : ''}
                  onChange={(e) => setPercent(j, toInt(e.target.value))}
                  aria-invalid={invalid || undefined}
                  className={controlClasses(invalid, 'h-9 pr-6 text-right tabular-nums')}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              {counts && (
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {counts[j]} item{counts[j] === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p
        className={cn('text-xs tabular-nums', total === 100 ? 'text-success' : 'text-primary')}
        aria-live="polite"
      >
        Total: {total}% {total === 100 ? '✓' : `(needs to be 100%)`}
      </p>
    </div>
  )
}
