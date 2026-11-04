import { cn } from '@renderer/lib/cn'

/**
 * Shared look for text inputs, selects and textareas. Controls are full width
 * unless `className` sets its own width (e.g. "w-16"), which then wins.
 */
export function controlClasses(hasError?: boolean, className?: string): string {
  const ownWidth = /(^|\s)(?:[a-z0-9]+:)*w-/.test(className ?? '')
  return cn(
    'block rounded-lg border bg-surface px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:outline-none disabled:opacity-60',
    !ownWidth && 'w-full',
    hasError
      ? 'border-primary focus:border-primary'
      : 'border-border hover:border-muted-foreground/40 focus:border-primary/60',
    className,
  )
}

/** aria-* props for a control inside <Field>. */
export function a11y(id: string, error?: string, hint?: unknown) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const
}
