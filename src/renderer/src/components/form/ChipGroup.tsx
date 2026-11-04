import { Check } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

export interface ChipOption<T extends string> {
  value: T
  label: string
  description?: string
}

/** Multi-select toggle chips (checkbox semantics). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  label: string
  options: readonly ChipOption<T>[]
  value: readonly T[]
  onChange: (value: T[]) => void
  invalid?: boolean
  describedBy?: string
}) {
  const toggle = (option: T) =>
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : options.map((o) => o.value).filter((v) => v === option || value.includes(v)),
    )

  return (
    <div
      role="group"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const selected = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={selected}
            title={o.description}
            onClick={() => toggle(o.value)}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
              selected
                ? 'border-primary/50 bg-primary-soft font-medium text-primary-soft-foreground'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
              invalid && !selected && 'border-primary/40',
            )}
          >
            {selected && <Check className="size-3.5" aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
