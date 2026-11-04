import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

interface FieldProps {
  label: string
  /** id of the control, so the label is associated with it. */
  htmlFor?: string
  required?: boolean
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}

/** Label + control + hint/error, with ARIA wiring done by the caller via `htmlFor`. */
export function Field({ label, htmlFor, required, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-primary" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="mt-1.5 flex items-start gap-1 text-xs text-primary"
          role="alert"
        >
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p
            id={htmlFor ? `${htmlFor}-hint` : undefined}
            className="mt-1.5 text-xs text-muted-foreground"
          >
            {hint}
          </p>
        )
      )}
    </div>
  )
}
