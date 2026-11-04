import { QUESTION_TYPES, QUESTION_TYPE_IDS, type QuestionType } from '@shared/teaching'
import type { QuestionTypeCount } from '@shared/documents'
import { controlClasses } from '@renderer/components/form/styles'
import { cn } from '@renderer/lib/cn'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

/**
 * Choose question types and how many items of each. The counts must add up to
 * the number of questions; the running total is shown live.
 */
export function QuestionTypeMixer({
  value,
  onChange,
  itemCount,
  invalid,
  describedBy,
}: {
  value: QuestionTypeCount[]
  onChange: (value: QuestionTypeCount[]) => void
  itemCount: number
  invalid?: boolean
  describedBy?: string
}) {
  const countOf = (type: QuestionType) => value.find((q) => q.type === type)?.count ?? 0
  const enabled = (type: QuestionType) => value.some((q) => q.type === type)
  const total = value.reduce((a, q) => a + q.count, 0)
  const remaining = itemCount - total

  /** Keep the list in the canonical order of question types. */
  const write = (next: Map<QuestionType, number>) =>
    onChange(
      QUESTION_TYPE_IDS.filter((t) => next.has(t)).map((type) => ({
        type,
        count: next.get(type)!,
      })),
    )

  const current = () => new Map(value.map((q) => [q.type, q.count] as const))

  const toggle = (type: QuestionType) => {
    const next = current()
    if (next.has(type)) next.delete(type)
    else next.set(type, Math.max(0, remaining))
    write(next)
  }

  const setCount = (type: QuestionType, count: number) => {
    const next = current()
    next.set(type, count)
    write(next)
  }

  return (
    <div role="group" aria-label="Question types" aria-describedby={describedBy}>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {QUESTION_TYPE_IDS.map((type) => {
          const on = enabled(type)
          const id = `qt-${type}`
          return (
            <li key={type} className="flex items-center gap-3 px-3 py-2">
              <input
                id={`${id}-on`}
                type="checkbox"
                checked={on}
                onChange={() => toggle(type)}
                className="size-4 shrink-0 cursor-pointer accent-primary"
              />
              <label htmlFor={`${id}-on`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{QUESTION_TYPES[type].label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {QUESTION_TYPES[type].description}
                </span>
              </label>
              <label htmlFor={id} className="sr-only">
                Number of {QUESTION_TYPES[type].label} items
              </label>
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                disabled={!on}
                value={on ? countOf(type) : ''}
                onChange={(e) => setCount(type, toInt(e.target.value))}
                className={controlClasses(
                  false,
                  'h-8 w-16 shrink-0 text-right tabular-nums disabled:opacity-40',
                )}
              />
            </li>
          )
        })}
      </ul>
      <p
        className={cn(
          'mt-1.5 text-xs tabular-nums',
          remaining === 0 && !invalid ? 'text-success' : 'text-primary',
        )}
        aria-live="polite"
      >
        {total} of {itemCount} items assigned
        {remaining > 0
          ? ` — ${remaining} left`
          : remaining < 0
            ? ` — ${-remaining} too many`
            : ' ✓'}
      </p>
    </div>
  )
}
