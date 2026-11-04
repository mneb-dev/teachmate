import { useMemo } from 'react'
import { CircleCheck, CircleX, ClipboardCheck, TriangleAlert } from 'lucide-react'
import { REVIEW_STATUSES, parseReview, type ReviewStatus } from '@shared/review'
import type { TeachingDocument } from '@shared/documents'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'

export function StatusBadge({ status }: { status: ReviewStatus | null }) {
  if (status === 'meets')
    return (
      <Badge tone="success">
        <CircleCheck className="size-3" aria-hidden />
        {REVIEW_STATUSES.meets}
      </Badge>
    )
  if (status === 'needs-improvement')
    return (
      <Badge tone="primary">
        <TriangleAlert className="size-3" aria-hidden />
        {REVIEW_STATUSES['needs-improvement']}
      </Badge>
    )
  if (status === 'missing')
    return (
      <Badge className="ring-1 ring-primary/40 ring-inset">
        <CircleX className="size-3" aria-hidden />
        {REVIEW_STATUSES.missing}
      </Badge>
    )
  return <Badge>No status</Badge>
}

/**
 * At-a-glance view of the review, read from the report by TeachMate: the
 * status of each criterion, improvement counts and alignment gaps.
 */
export function ReviewSummary({ doc }: { doc: TeachingDocument }) {
  const parsed = useMemo(() => parseReview(doc.content), [doc.content])
  if (doc.kind !== 'lesson-plan-review') return null
  if (!parsed.overall && parsed.criteria.every((c) => !c.found)) return null

  const count = (s: ReviewStatus) => parsed.criteria.filter((c) => c.status === s).length
  const { critical, recommended, optional } = parsed.improvements

  return (
    <Card aria-label="Review summary">
      <CardHeader
        title="Review summary"
        description="Read from the review by TeachMate. Statuses are the reviewer’s; no scores are calculated."
        icon={<IconTile icon={ClipboardCheck} size="sm" tone="muted" />}
      />
      <div className="space-y-5 p-5 pt-4">
        {parsed.overall && (
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm" data-role="overall">
            <span className="font-medium">Overall assessment: </span>
            {parsed.overall.replace(/\*\*/g, '')}
          </p>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Criteria</span>
            <span>
              {count('meets')} meet · {count('needs-improvement')} need improvement ·{' '}
              {count('missing')} missing
            </span>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {parsed.criteria.map((c) => (
              <li
                key={c.letter}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                data-criterion={c.letter}
              >
                <span className="w-5 font-semibold text-muted-foreground">{c.letter}</span>
                <span className="min-w-0 flex-1">{c.label}</span>
                {c.found ? <StatusBadge status={c.status} /> : <Badge>Not reviewed</Badge>}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium">Improvement suggestions</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between gap-2">
                Critical <Badge tone={critical > 0 ? 'primary' : 'neutral'}>{critical}</Badge>
              </li>
              <li className="flex justify-between gap-2">
                Recommended <Badge>{recommended}</Badge>
              </li>
              <li className="flex justify-between gap-2">
                Optional <Badge>{optional}</Badge>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Alignment gaps</p>
            <ul className="space-y-1.5 text-sm" aria-label="Alignment gaps">
              {parsed.gaps.map((g) => (
                <li key={g.label} className="flex items-start justify-between gap-2">
                  <span className="text-xs leading-5">{g.label}</span>
                  {g.text === null ? (
                    <Badge>Not reported</Badge>
                  ) : g.none ? (
                    <Badge tone="success">None found</Badge>
                  ) : (
                    <Badge tone="primary" title={g.text}>
                      Found
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  )
}
