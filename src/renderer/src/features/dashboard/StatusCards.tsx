import { HardDrive, PlugZap, Settings } from 'lucide-react'
import { ButtonLink } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { StatusDot } from '@renderer/components/ui/StatusDot'
import { useAppInfo } from '@renderer/hooks/useAppInfo'
import { useProviders } from '@renderer/hooks/useProviders'

export function AiConnectionCard() {
  const providers = useProviders()
  const provider = providers.status === 'ok' ? providers.providers[0] : undefined

  return (
    <Card>
      <CardHeader title="AI connection" icon={<IconTile icon={PlugZap} size="sm" tone="muted" />} />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2">
          <StatusDot tone={provider?.state === 'ready' ? 'success' : 'neutral'} />
          <span className="text-sm font-medium">
            {providers.status === 'loading'
              ? 'Checking…'
              : provider
                ? provider.name
                : 'No provider available'}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {provider?.kind === 'handoff'
            ? provider.state === 'ready'
              ? 'Prompts are prepared in TeachMate and continued in Claude Code with your own Claude account. Replies stay in Claude Code.'
              : provider.statusDetail
            : (provider?.statusDetail ?? 'AI features aren’t available right now.')}
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/ai-assistant" size="sm">
            Open AI Assistant
          </ButtonLink>
          <ButtonLink to="/settings" variant="secondary" size="sm">
            <Settings className="size-4" aria-hidden />
            Settings
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  )
}

export function LocalStorageCard({ documentCount }: { documentCount: number | null }) {
  const info = useAppInfo()

  return (
    <Card>
      <CardHeader
        title="Local storage"
        icon={<IconTile icon={HardDrive} size="sm" tone="muted" />}
      />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2">
          <StatusDot tone={info.status === 'ok' ? 'success' : 'neutral'} />
          <span className="text-sm font-medium">
            {info.status === 'ok'
              ? 'Stored on this device'
              : info.status === 'pending'
                ? 'Checking…'
                : 'Unavailable'}
          </span>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Data folder</dt>
            <dd
              className="mt-0.5 truncate font-mono text-xs"
              title={info.status === 'ok' ? info.data.dataPath : undefined}
            >
              {info.status === 'ok' ? info.data.dataPath : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Saved documents</dt>
            <dd className="font-medium tabular-nums">{documentCount ?? '–'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Cloud sync</dt>
            <dd className="font-medium">Off — local only</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  )
}
