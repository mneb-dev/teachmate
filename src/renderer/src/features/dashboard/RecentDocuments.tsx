import { FilePlus2, FileText } from 'lucide-react'
import { Link } from 'react-router'
import { DOCUMENT_KINDS, type DocumentSummary } from '@shared/documents'
import { DOCUMENT_KIND_NAV, getNavItem } from '@renderer/app/navigation'
import { Badge } from '@renderer/components/ui/Badge'
import { ButtonLink } from '@renderer/components/ui/Button'
import { Card, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { formatRelativeTime } from '@renderer/lib/format'

const SHOWN = 5

/** Most recently updated documents, read from local storage. */
export function RecentDocuments({
  documents,
  error,
}: {
  documents: DocumentSummary[] | null
  error: string | null
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Recently created documents"
        description="Pick up where you left off."
        icon={<IconTile icon={FileText} size="sm" tone="muted" />}
        action={
          <Link
            to="/saved-documents"
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            View all
          </Link>
        }
      />
      {error && <p className="px-5 py-4 text-sm text-primary">Couldn’t load documents: {error}</p>}
      {!error && documents === null && (
        <p className="px-5 py-4 text-sm text-muted-foreground">Loading…</p>
      )}
      {documents?.length === 0 && (
        <div className="px-5 pt-3 pb-5">
          <p className="text-sm text-muted-foreground">No documents yet.</p>
          <ButtonLink to="/lesson-planner" variant="secondary" size="sm" className="mt-3">
            <FilePlus2 className="size-4" aria-hidden />
            Create a lesson plan
          </ButtonLink>
        </div>
      )}
      {documents && documents.length > 0 && (
        <ul className="mt-3 divide-y divide-border px-2 pb-2">
          {documents.slice(0, SHOWN).map((doc) => {
            const tool = getNavItem(DOCUMENT_KIND_NAV[doc.kind])
            return (
              <li key={doc.id}>
                <Link
                  to={`${DOCUMENT_KINDS[doc.kind].path}?d=${encodeURIComponent(doc.id)}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-muted"
                >
                  <IconTile icon={tool.icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{doc.subtitle}</p>
                  </div>
                  {doc.hasContent ? null : <Badge className="hidden sm:inline-flex">Draft</Badge>}
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    {formatRelativeTime(new Date(doc.updatedAt))}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
