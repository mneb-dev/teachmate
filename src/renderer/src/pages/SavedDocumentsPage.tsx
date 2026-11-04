import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  CircleCheck,
  FileCode2,
  FileDown,
  FileUp,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Search,
  SquarePen,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { DOCUMENT_KINDS, type DocumentKind, type DocumentSummary } from '@shared/documents'
import type { ExportResult } from '@shared/ipc'
import { DOCUMENT_KIND_NAV, getNavItem } from '@renderer/app/navigation'
import { controlClasses } from '@renderer/components/form/styles'
import { Badge } from '@renderer/components/ui/Badge'
import { Button, ButtonLink } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'
import { Dialog } from '@renderer/components/ui/Dialog'
import { IconButton } from '@renderer/components/ui/IconButton'
import { IconTile } from '@renderer/components/ui/IconTile'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { cn } from '@renderer/lib/cn'
import { formatRelativeTime } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

/** Categories in the order teachers use them. */
const CATEGORIES: Array<{ kind: DocumentKind; label: string }> = [
  { kind: 'lesson-plan', label: 'Lesson Plans' },
  { kind: 'learning-objectives', label: 'Objectives' },
  { kind: 'learning-activities', label: 'Activities' },
  { kind: 'assessment', label: 'Assessments' },
  { kind: 'tos', label: 'TOS' },
  { kind: 'performance-task', label: 'Performance Tasks' },
  { kind: 'rubric', label: 'Rubrics' },
  { kind: 'annotation', label: 'Annotations' },
  { kind: 'lesson-plan-review', label: 'Reviews' },
]

/** Kinds whose content is text and can be imported from a file. */
const IMPORTABLE: DocumentKind[] = [
  'lesson-plan',
  'learning-objectives',
  'learning-activities',
  'assessment',
  'performance-task',
  'annotation',
]

const openPath = (d: DocumentSummary) =>
  `${DOCUMENT_KINDS[d.kind].path}?d=${encodeURIComponent(d.id)}`

export function SavedDocumentsPage() {
  const nav = getNavItem('saved-documents')
  const navigate = useNavigate()
  const [items, setItems] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | DocumentKind>('all')
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null)
  const [renaming, setRenaming] = useState<DocumentSummary | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exported, setExported] = useState<{ id: string; path: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)

  useEffect(() => {
    let cancelled = false
    teachmate.documents
      .list()
      .then((list) => !cancelled && setItems(list))
      .catch((err: unknown) => !cancelled && setError(ipcErrorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [version])

  const counts = useMemo(() => {
    const c = new Map<DocumentKind, number>()
    for (const d of items ?? []) c.set(d.kind, (c.get(d.kind) ?? 0) + 1)
    return c
  }, [items])

  const q = query.trim().toLowerCase()
  const shown = (items ?? []).filter(
    (d) =>
      (category === 'all' || d.kind === category) &&
      (!q || d.title.toLowerCase().includes(q) || d.subtitle.toLowerCase().includes(q)),
  )

  const runExport = async (d: DocumentSummary, run: () => Promise<ExportResult>) => {
    setBusyId(d.id)
    setError(null)
    setExported(null)
    try {
      const result = await run()
      if (result.status === 'saved') setExported({ id: d.id, path: result.path })
    } catch (err) {
      setError(ipcErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        title={nav.label}
        description="Everything you have created, stored on this device."
        icon={nav.icon}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
            <FileUp className="size-4" aria-hidden />
            Import a file
          </Button>
        }
      />

      {error && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            className="cursor-pointer text-xs font-medium hover:underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Document categories">
          <ul className="space-y-0.5">
            {[{ kind: 'all' as const, label: 'All documents' }, ...CATEGORIES].map((c) => {
              const count = c.kind === 'all' ? (items?.length ?? 0) : (counts.get(c.kind) ?? 0)
              const active = category === c.kind
              return (
                <li key={c.kind}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setCategory(c.kind)}
                    className={cn(
                      'flex h-9 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-sm transition-colors',
                      active
                        ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                        : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                    )}
                  >
                    {c.label}
                    <span className="text-xs tabular-nums">{count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <Card>
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, subject or grade"
                aria-label="Search saved documents"
                className={controlClasses(false, 'h-9 pl-9')}
              />
            </div>
          </div>

          {items === null && !error && (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          )}
          {items !== null && shown.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? 'Nothing saved yet. Documents you create or import appear here.'
                : q
                  ? 'No documents match your search.'
                  : 'No documents in this category yet.'}
            </p>
          )}

          <ul className="divide-y divide-border" aria-label="Saved documents">
            {shown.map((d) => {
              const tool = getNavItem(DOCUMENT_KIND_NAV[d.kind])
              const busy = busyId === d.id
              return (
                <li key={d.id} className="px-4 py-3" data-role="saved-document">
                  <div className="flex items-center gap-3">
                    <IconTile icon={tool.icon} size="sm" />
                    <button
                      type="button"
                      onClick={() => navigate(openPath(d))}
                      className="min-w-0 flex-1 cursor-pointer text-left hover:text-primary"
                    >
                      <span className="block truncate text-sm font-medium">{d.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.subtitle} · updated {formatRelativeTime(new Date(d.updatedAt))}
                      </span>
                    </button>
                    {!d.hasContent && <Badge>Draft</Badge>}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <ButtonLink
                        to={openPath(d)}
                        size="sm"
                        variant="ghost"
                        aria-label={`Open and edit “${d.title}”`}
                      >
                        <SquarePen className="size-4" aria-hidden />
                        Open
                      </ButtonLink>
                      <IconButton label={`Rename “${d.title}”`} onClick={() => setRenaming(d)}>
                        <Pencil className="size-4" aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Export “${d.title}” to Word`}
                        disabled={busy || !d.hasContent}
                        onClick={() =>
                          void runExport(d, () => teachmate.documents.exportDocx(d.id, 'full'))
                        }
                      >
                        {busy ? (
                          <LoaderCircle className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <FileDown className="size-4" aria-hidden />
                        )}
                      </IconButton>
                      <IconButton
                        label={`Export “${d.title}” to Markdown`}
                        disabled={busy || !d.hasContent}
                        onClick={() =>
                          void runExport(d, () => teachmate.documents.exportMarkdown(d.id))
                        }
                      >
                        <FileCode2 className="size-4" aria-hidden />
                      </IconButton>
                      <IconButton label={`Delete “${d.title}”`} onClick={() => setDeleting(d)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                  {exported?.id === d.id && (
                    <p
                      role="status"
                      className="mt-1.5 flex items-center gap-2 pl-11 text-xs text-success"
                    >
                      <CircleCheck className="size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate" title={exported.path}>
                        Exported {exported.path.split(/[\\/]/).pop()}
                      </span>
                      <button
                        type="button"
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-medium text-primary hover:text-primary-hover"
                        onClick={() => void teachmate.documents.revealExport(exported.path)}
                      >
                        <FolderOpen className="size-3.5" aria-hidden />
                        Show in folder
                      </button>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <RenameDialog
        target={renaming}
        onClose={() => setRenaming(null)}
        onSaved={() => {
          setRenaming(null)
          refresh()
        }}
      />

      <ImportDialog
        open={importOpen}
        defaultKind={category !== 'all' && IMPORTABLE.includes(category) ? category : 'lesson-plan'}
        onClose={() => setImportOpen(false)}
        onImported={(doc) => {
          setImportOpen(false)
          navigate(`${DOCUMENT_KINDS[doc.kind].path}?d=${encodeURIComponent(doc.id)}`)
        }}
      />

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete document?"
        description={`“${deleting?.title ?? ''}” will be permanently removed from this device.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!deleting) return
                teachmate.documents
                  .delete(deleting.id)
                  .then(refresh)
                  .catch((err: unknown) => setError(ipcErrorMessage(err)))
                  .finally(() => setDeleting(null))
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          </>
        }
      />
    </>
  )
}

function RenameDialog({
  target,
  onClose,
  onSaved,
}: {
  target: DocumentSummary | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastId, setLastId] = useState<string | null>(null)
  if (target && target.id !== lastId) {
    setLastId(target.id)
    setTitle(target.title)
    setError(null)
  }
  const save = () => {
    if (!target) return
    teachmate.documents
      .rename(target.id, title)
      .then(onSaved)
      .catch((err: unknown) => setError(ipcErrorMessage(err)))
  }
  return (
    <Dialog
      open={target !== null}
      onClose={() => {
        setLastId(null)
        onClose()
      }}
      title="Rename document"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!title.trim()} onClick={save}>
            Rename
          </Button>
        </>
      }
    >
      <label htmlFor="rename-title" className="mb-1.5 block text-sm font-medium">
        Title
      </label>
      <input
        id="rename-title"
        autoFocus
        value={title}
        maxLength={160}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className={controlClasses(!!error, 'h-10')}
      />
      {error && <p className="mt-2 text-xs text-primary">{error}</p>}
    </Dialog>
  )
}

function ImportDialog({
  open,
  defaultKind,
  onClose,
  onImported,
}: {
  open: boolean
  defaultKind: DocumentKind
  onClose: () => void
  onImported: (doc: { id: string; kind: DocumentKind }) => void
}) {
  const [kind, setKind] = useState<DocumentKind>(defaultKind)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const run = () => {
    setWorking(true)
    setError(null)
    teachmate.documents
      .import(kind)
      .then((doc) => doc && onImported(doc))
      .catch((err: unknown) => setError(ipcErrorMessage(err)))
      .finally(() => setWorking(false))
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import a file"
      description="Choose a DOCX, PDF, TXT or Markdown file. Its text becomes a new document you can edit; the original file is kept unchanged in Teaching Resources."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={run} disabled={working}>
            {working ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileUp className="size-4" aria-hidden />
            )}
            Choose file…
          </Button>
        </>
      }
    >
      <label htmlFor="import-kind" className="mb-1.5 block text-sm font-medium">
        Import as
      </label>
      <select
        id="import-kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as DocumentKind)}
        className={controlClasses(false, 'h-10')}
      >
        {IMPORTABLE.map((k) => (
          <option key={k} value={k}>
            {DOCUMENT_KINDS[k].label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-muted-foreground">
        Tables of Specifications and rubrics are calculated, so they can’t be imported from a file.
      </p>
      {error && <p className="mt-2 text-sm text-primary">{error}</p>}
    </Dialog>
  )
}
