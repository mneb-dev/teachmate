import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { DocumentKind, DocumentSummary } from '@shared/documents'
import { controlClasses } from '@renderer/components/form/styles'
import { Badge } from '@renderer/components/ui/Badge'
import { Dialog } from '@renderer/components/ui/Dialog'
import { formatRelativeTime } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

export function OpenSavedDialog({
  open,
  kind,
  noun,
  title,
  onClose,
  onOpen,
}: {
  open: boolean
  kind: DocumentKind
  noun: string
  /** Dialog title; defaults to "Open a saved <noun>". */
  title?: string
  onClose: () => void
  onOpen: (id: string) => void
}) {
  const [items, setItems] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    teachmate.documents
      .list(kind)
      .then((list) => !cancelled && setItems(list))
      .catch((err: unknown) => !cancelled && setError(ipcErrorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [open, kind])

  const q = query.trim().toLowerCase()
  const shown = (items ?? []).filter(
    (d) => !q || d.title.toLowerCase().includes(q) || d.subtitle.toLowerCase().includes(q),
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? `Open a saved ${noun}`}
      className="max-w-xl"
    >
      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, subject or grade"
          aria-label={`Search saved ${noun}s`}
          className={controlClasses(false, 'h-9 pl-9')}
        />
      </div>
      {error && <p className="text-sm text-primary">{error}</p>}
      {!error && items === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {items !== null && shown.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {items.length === 0 ? `No saved ${noun}s yet.` : 'Nothing matches your search.'}
        </p>
      )}
      <ul className="space-y-1" aria-label={`Saved ${noun}s`}>
        {shown.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onOpen(d.id)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {d.subtitle} · {formatRelativeTime(new Date(d.updatedAt))}
                </span>
              </span>
              {!d.hasContent && <Badge>Draft</Badge>}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
