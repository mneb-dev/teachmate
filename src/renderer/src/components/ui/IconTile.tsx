import type { LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

type IconTileTone = 'soft' | 'solid' | 'muted'
type IconTileSize = 'sm' | 'md' | 'lg'

const tones: Record<IconTileTone, string> = {
  soft: 'bg-primary-soft text-primary-soft-foreground',
  solid: 'bg-primary text-primary-foreground',
  muted: 'bg-surface-muted text-muted-foreground',
}

const sizes: Record<IconTileSize, { box: string; icon: string }> = {
  sm: { box: 'size-8 rounded-lg', icon: 'size-4' },
  md: { box: 'size-10 rounded-xl', icon: 'size-5' },
  lg: { box: 'size-12 rounded-xl', icon: 'size-6' },
}

export function IconTile({
  icon: Icon,
  tone = 'soft',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone?: IconTileTone
  size?: IconTileSize
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center',
        tones[tone],
        sizes[size].box,
        className,
      )}
    >
      <Icon className={sizes[size].icon} aria-hidden strokeWidth={1.75} />
    </div>
  )
}
