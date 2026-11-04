import { useEffect, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import type { ResourceMeta } from '@shared/resources'
import { controlClasses } from '@renderer/components/form/styles'
import { Badge } from '@renderer/components/ui/Badge'
import { Dialog } from '@renderer/components/ui/Dialog'
import { formatRelativeTime } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

/** Pick a file from the Teaching Resources library. */
export function LibraryPickerDialog({
  open,
  title = 'Choose from Teaching Resources',
  onClose,
  onPick,
}: {
  open: boolean
  title?: string
  onClose: () => void
  onPick: (resource: ResourceMeta) => void
}) {
  const [items, setItems] = useState<ResourceMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(() => {
      teachmate.resources
        .list(query.trim() ? { query } : {})
        .then((list) => !cancelled && setItems(list))
        .catch((err: unknown) => !cancelled && setError(ipcErrorMessage(err)))
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query])

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-xl">
      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, tags or text"
          aria-label="Search the library"
          className={controlClasses(false, 'h-9 pl-9')}
        />
      </div>
      {error && <p className="text-sm text-primary">{error}</p>}
      {!error && items === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {items?.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {query.trim()
            ? 'Nothing matches your search.'
            : 'The library is empty. Add files under Teaching Resources.'}
        </p>
      )}
      <ul className="space-y-1" aria-label="Library files">
        {items?.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted"
            >
              <FileText className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[r.subject, r.gradeLevel, r.originalName].filter(Boolean).join(' · ')} ·{' '}
                  {formatRelativeTime(new Date(r.updatedAt))}
                </span>
              </span>
              <Badge>{r.kind.toUpperCase()}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
