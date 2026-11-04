import { Check, HardDrive, Info, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { SETTINGS_ITEM } from '@renderer/app/navigation'
import { StatusRow } from '@renderer/components/StatusRow'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import { AiProviderSettings } from '@renderer/features/settings/AiProviderSettings'
import { ProfileSettings } from '@renderer/features/settings/ProfileSettings'
import { TeachingDefaultsSettings } from '@renderer/features/settings/TeachingDefaultsSettings'
import { useAppInfo } from '@renderer/hooks/useAppInfo'
import { cn } from '@renderer/lib/cn'
import { PRIMARY_PRESETS, swatchColor } from '@renderer/theme/palette'
import { useTheme, type ThemeMode } from '@renderer/theme/theme-context'

const nodeIntegrationDisabled =
  typeof (window as unknown as { require?: unknown }).require === 'undefined' &&
  typeof (globalThis as { process?: unknown }).process === 'undefined'

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title={SETTINGS_ITEM.label}
        description={SETTINGS_ITEM.description}
        icon={SETTINGS_ITEM.icon}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <ProfileSettings />
          <AppearanceSettings />
          <TeachingDefaultsSettings />
        </div>
        <div className="space-y-6">
          <AiProviderSettings />
          <DataSettings />
        </div>
        <AboutCard />
      </div>
    </>
  )
}

function AppearanceSettings() {
  const { mode, setMode, primaryHue, setPrimaryHue } = useTheme()

  return (
    <Card>
      <CardHeader
        title="Appearance"
        description="Theme and accent color for this device."
        icon={<IconTile icon={Palette} size="sm" tone="muted" />}
      />
      <CardBody className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">Theme</p>
          <SegmentedControl<ThemeMode>
            label="Theme"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ]}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Primary color</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Primary color">
            {PRIMARY_PRESETS.map((preset) => {
              const selected = preset.hue === primaryHue
              return (
                <button
                  key={preset.name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={preset.name}
                  title={preset.name}
                  onClick={() => setPrimaryHue(preset.hue)}
                  className={cn(
                    'flex size-9 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-shadow',
                    selected ? 'ring-2 ring-foreground' : 'hover:ring-2 hover:ring-border',
                  )}
                  style={{ backgroundColor: swatchColor(preset.hue) }}
                >
                  {selected && <Check className="size-4 text-white" aria-hidden />}
                </button>
              )
            })}
          </div>

          <label className="mt-4 block">
            <span className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              Custom hue
              <span className="font-mono text-xs tabular-nums">{primaryHue}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={360}
              value={primaryHue}
              onChange={(e) => setPrimaryHue(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
              style={{
                background:
                  'linear-gradient(to right, oklch(0.6 0.22 0), oklch(0.6 0.22 60), oklch(0.6 0.22 120), oklch(0.6 0.22 180), oklch(0.6 0.22 240), oklch(0.6 0.22 300), oklch(0.6 0.22 360))',
              }}
            />
          </label>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Preview</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Primary button
            </span>
            <Badge tone="primary">Badge</Badge>
            <span className="text-sm font-medium text-primary">Link text</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function DataSettings() {
  const info = useAppInfo()
  return (
    <Card>
      <CardHeader
        title="Data & storage"
        description="All TeachMate data stays on this computer."
        icon={<IconTile icon={HardDrive} size="sm" tone="muted" />}
      />
      <CardBody>
        <p className="text-xs text-muted-foreground">Data folder</p>
        <p className="mt-1 truncate font-mono text-xs">
          {info.status === 'ok' ? info.data.dataPath : '—'}
        </p>
      </CardBody>
    </Card>
  )
}

function AboutCard() {
  const info = useAppInfo()
  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="About & system check"
        icon={<IconTile icon={Info} size="sm" tone="muted" />}
      />
      <CardBody className="pt-2">
        <ul className="divide-y divide-border">
          <StatusRow
            label="Main process connection"
            status={info.status}
            detail={
              info.status === 'ok'
                ? `TeachMate v${info.data.version} · ${info.data.platform} · Electron ${info.data.versions.electron}`
                : info.status === 'fail'
                  ? info.error
                  : undefined
            }
          />
          <StatusRow
            label="Node integration disabled in UI"
            status={nodeIntegrationDisabled ? 'ok' : 'fail'}
            detail={nodeIntegrationDisabled ? 'require / process unavailable' : 'Node APIs exposed'}
          />
        </ul>
      </CardBody>
    </Card>
  )
}
