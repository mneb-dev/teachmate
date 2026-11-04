import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

type BadgeTone = 'neutral' | 'primary' | 'success'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success',
}

export function Badge({
  tone = 'neutral',
  className,
  title,
  children,
}: {
  tone?: BadgeTone
  className?: string
  title?: string
  children: ReactNode
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Marks a card whose content is illustrative sample data. */
export function SampleBadge() {
  return <Badge title="Illustrative data for UI preview">Sample</Badge>
}
