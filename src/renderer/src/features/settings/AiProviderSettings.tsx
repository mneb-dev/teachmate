import { useEffect, useState } from 'react'
import { ExternalLink, FolderOpen, PlugZap, ShieldCheck, X } from 'lucide-react'
import type { AppSettings } from '@shared/ai'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { StatusDot } from '@renderer/components/ui/StatusDot'
import { useProviders } from '@renderer/hooks/useProviders'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

export function AiProviderSettings() {
  const providers = useProviders()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    teachmate.settings
      .get()
      .then(setSettings)
      .catch((err: unknown) => setError(ipcErrorMessage(err)))
  }, [])

  const update = (action: () => Promise<AppSettings>) => {
    setError(null)
    action()
      .then(setSettings)
      .catch((err: unknown) => setError(ipcErrorMessage(err)))
  }

  return (
    <Card>
      <CardHeader
        title="AI provider"
        description="How TeachMate’s AI Assistant reaches an AI model."
        icon={<IconTile icon={PlugZap} size="sm" tone="muted" />}
      />
      <CardBody className="space-y-5">
        {providers.status === 'loading' && (
          <p className="text-sm text-muted-foreground">Checking…</p>
        )}
        {providers.status === 'error' && <p className="text-sm text-primary">{providers.error}</p>}
        {providers.status === 'ok' &&
          providers.providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <StatusDot tone={p.state === 'ready' ? 'success' : 'neutral'} />
                  {p.name}
                </p>
                <Badge tone={p.state === 'ready' ? 'success' : 'neutral'}>
                  {p.state === 'ready'
                    ? 'Ready'
                    : p.state === 'needs-setup'
                      ? 'Needs setup'
                      : 'Unavailable'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              {p.state !== 'ready' && (
                <p className="mt-2 text-xs text-muted-foreground">{p.statusDetail}</p>
              )}
              <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={providers.refresh}>
                Check again
              </Button>
            </div>
          ))}

        <div>
          <p className="text-sm font-medium">Claude Code workspace folder</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Claude Code opens in this folder during a handoff. If none is set, it opens in
            TeachMate’s own prompts folder.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface-muted/50 px-3 py-2">
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={settings?.claudeCodeWorkspace ?? undefined}
            >
              {settings
                ? (settings.claudeCodeWorkspace ?? 'Not set (uses TeachMate’s prompts folder)')
                : '…'}
            </span>
            {settings?.claudeCodeWorkspace && (
              <button
                type="button"
                aria-label="Clear workspace folder"
                title="Clear"
                onClick={() => update(teachmate.settings.clearClaudeWorkspace)}
                className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => update(teachmate.settings.chooseClaudeWorkspace)}
          >
            Choose folder…
          </Button>
          {error && <p className="mt-2 text-xs text-primary">{error}</p>}
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-surface-muted/60 p-4 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <p>
            TeachMate never asks for, reads or stores your Claude login. Anthropic doesn’t allow
            third-party apps to sign in with Claude Pro/Max accounts, so prompts are handed off to
            Claude Code, which you use with your own account. Support for an official AI API (with
            an API key) can be added later as another provider.{' '}
            <a
              href="https://code.claude.com/docs/en/deep-links"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:text-primary-hover"
            >
              How the handoff works
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
        </div>
      </CardBody>
    </Card>
  )
}
