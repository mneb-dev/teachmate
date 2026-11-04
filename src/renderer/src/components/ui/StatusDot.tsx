import { cn } from '@renderer/lib/cn'

export type StatusTone = 'success' | 'neutral' | 'primary'

const tones: Record<StatusTone, string> = {
  success: 'bg-success',
  neutral: 'bg-muted-foreground/50',
  primary: 'bg-primary',
}

export function StatusDot({ tone, pulse = false }: { tone: StatusTone; pulse?: boolean }) {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-60',
            tones[tone],
          )}
        />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', tones[tone])} />
    </span>
  )
}
