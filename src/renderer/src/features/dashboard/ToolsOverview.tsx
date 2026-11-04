import { LayoutGrid } from 'lucide-react'
import { Link } from 'react-router'
import type { DocumentSummary } from '@shared/documents'
import { NAV_GROUPS, type NavId } from '@renderer/app/navigation'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'

/** Teaching tools = the Planning, Assessment and Review groups. */
const TOOL_GROUPS = NAV_GROUPS.filter((g) =>
  ['Planning', 'Assessment', 'Review'].includes(g.label ?? ''),
)

/** Tools that create saved documents, and the document kind they create. */
const AVAILABLE: Partial<Record<NavId, DocumentSummary['kind']>> = {
  'lesson-planner': 'lesson-plan',
  'learning-objectives': 'learning-objectives',
  'learning-activities': 'learning-activities',
  assessments: 'assessment',
  'table-of-specifications': 'tos',
  'performance-tasks': 'performance-task',
  rubrics: 'rubric',
  'dll-annotation': 'annotation',
  'lesson-reviewer': 'lesson-plan-review',
}

export function ToolsOverview({ documents }: { documents: DocumentSummary[] | null }) {
  const countFor = (id: NavId) => {
    const kind = AVAILABLE[id]
    return kind && documents ? documents.filter((d) => d.kind === kind).length : null
  }

  return (
    <Card>
      <CardHeader
        title="Teaching tools"
        description="Everything you can create with TeachMate."
        icon={<IconTile icon={LayoutGrid} size="sm" tone="muted" />}
      />
      <div className="space-y-5 p-5">
        {TOOL_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.items.map((tool) => {
                const available = tool.id in AVAILABLE
                const count = countFor(tool.id)
                return (
                  <Link
                    key={tool.id}
                    to={tool.path}
                    className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-surface-muted"
                  >
                    <IconTile icon={tool.icon} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tool.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                    {available ? (
                      <span
                        className="shrink-0 text-sm font-semibold tabular-nums"
                        title={`${count ?? 0} saved`}
                      >
                        {count ?? '–'}
                      </span>
                    ) : (
                      <Badge className="shrink-0">Soon</Badge>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
