import { Moon, Sun } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { findNavItemByPath } from '@renderer/app/navigation'
import { StatusDot } from '@renderer/components/ui/StatusDot'
import { Button } from '@renderer/components/ui/Button'
import { useProviders } from '@renderer/hooks/useProviders'
import { useTheme } from '@renderer/theme/theme-context'

export function Topbar() {
  const { pathname } = useLocation()
  const current = findNavItemByPath(pathname)
  const { resolvedTheme, toggleTheme } = useTheme()
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  const providers = useProviders()
  const provider = providers.status === 'ok' ? providers.providers[0] : undefined
  const aiStatusLabel =
    providers.status === 'loading'
      ? 'Checking AI…'
      : !provider
        ? 'AI unavailable'
        : provider.kind === 'handoff'
          ? provider.state === 'ready'
            ? 'Claude Code handoff'
            : 'Claude Code not detected'
          : provider.state === 'ready'
            ? `${provider.name} connected`
            : `${provider.name} needs setup`

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/80 px-6 backdrop-blur lg:px-8">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-muted-foreground">TeachMate</span>
        <span className="text-muted-foreground/60" aria-hidden>
          /
        </span>
        <span className="truncate font-medium text-foreground">{current?.label ?? 'Page'}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/settings"
          className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground sm:inline-flex"
          title={provider?.statusDetail ?? 'AI provider status'}
        >
          <StatusDot tone={provider?.state === 'ready' ? 'success' : 'neutral'} />
          {aiStatusLabel}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${nextTheme} mode`}
          title={`Switch to ${nextTheme} mode`}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="size-[18px]" aria-hidden />
          ) : (
            <Moon className="size-[18px]" aria-hidden />
          )}
        </Button>
      </div>
    </header>
  )
}
