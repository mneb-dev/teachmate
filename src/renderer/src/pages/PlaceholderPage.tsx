import { ArrowLeft, Check, Construction } from 'lucide-react'
import type { NavItem } from '@renderer/app/navigation'
import { ButtonLink } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Card } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { PageHeader } from '@renderer/components/ui/PageHeader'

/** Shared "coming soon" page used by every module that isn't built yet. */
export function PlaceholderPage({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader
        title={item.label}
        description={item.description}
        icon={item.icon}
        actions={<Badge tone="primary">Coming soon</Badge>}
      />

      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <IconTile icon={Construction} size="lg" tone="muted" />
        <h2 className="mt-4 text-lg font-semibold">{item.label} is on the way</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          This module hasn’t been built yet. Here’s what it will help you do:
        </p>

        {item.plannedFeatures.length > 0 && (
          <ul className="mt-6 w-full max-w-md space-y-2 text-left">
            {item.plannedFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted/50 px-4 py-3 text-sm"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        )}

        <ButtonLink to="/" variant="secondary" size="sm" className="mt-8">
          <ArrowLeft className="size-4" aria-hidden />
          Back to Dashboard
        </ButtonLink>
      </Card>
    </>
  )
}
