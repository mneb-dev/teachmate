import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleCheck,
  ExternalLink,
  FileText,
  FolderOpen,
  LoaderCircle,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import {
  RESOURCE_LIMITS,
  parseTagInput,
  type ResourceDetail,
  type ResourceImportResult,
  type ResourceMeta,
} from '@shared/resources'
import { GRADE_LEVELS, SUBJECT_SUGGESTIONS } from '@shared/teaching'
import { getNavItem } from '@renderer/app/navigation'
import { Field } from '@renderer/components/form/Field'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'
import { Dialog } from '@renderer/components/ui/Dialog'
import { Markdown } from '@renderer/components/ui/Markdown'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { cn } from '@renderer/lib/cn'
import { formatRelativeTime } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

const PREVIEW_CHARS = 20_000

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const unique = (values: string[]) =>
  [...new Map(values.filter((v) => v.trim()).map((v) => [v.toLowerCase(), v])).values()].sort()

export function ResourcesPage() {
  const nav = getNavItem('teaching-resources')
  const [all, setAll] = useState<ResourceMeta[] | null>(null)
  const [shown, setShown] = useState<ResourceMeta[] | null>(null)
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [tag, setTag] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [lastImport, setLastImport] = useState<ResourceImportResult | null>(null)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    teachmate.resources
      .list()
      .then((list) => !cancelled && setAll(list))
      .catch((err: unknown) => !cancelled && setError(ipcErrorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [version])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      teachmate.resources
        .list({
          ...(query.trim() ? { query } : {}),
          ...(subject ? { subject } : {}),
          ...(grade ? { gradeLevel: grade } : {}),
          ...(tag ? { tag } : {}),
        })
        .then((list) => !cancelled && setShown(list))
        .catch((err: unknown) => !cancelled && setError(ipcErrorMessage(err)))
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, subject, grade, tag, version])

  const subjects = useMemo(() => unique((all ?? []).map((r) => r.subject)), [all])
  const grades = useMemo(() => unique((all ?? []).map((r) => r.gradeLevel)), [all])
  const tags = useMemo(() => unique((all ?? []).flatMap((r) => r.tags)), [all])

  const addFiles = async () => {
    setImporting(true)
    setError(null)
    try {
      const result = await teachmate.resources.import()
      setLastImport(result)
      if (result.imported[0]) setSelectedId(result.imported[0].id)
      refresh()
    } catch (err) {
      setError(ipcErrorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  const addDuplicate = async (token: string) => {
    try {
      const r = await teachmate.resources.importDuplicate(token)
      setLastImport((prev) =>
        prev
          ? {
              ...prev,
              imported: [...prev.imported, r],
              duplicates: prev.duplicates.filter((d) => d.token !== token),
            }
          : prev,
      )
      setSelectedId(r.id)
      refresh()
    } catch (err) {
      setError(ipcErrorMessage(err))
    }
  }

  const filtered = Boolean(query.trim() || subject || grade || tag)

  return (
    <>
      <PageHeader
        title={nav.label}
        description="Your local library of lesson files and references. Originals are kept unchanged on this device."
        icon={nav.icon}
        actions={
          <Button size="sm" onClick={() => void addFiles()} disabled={importing}>
            {importing ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Add files
          </Button>
        }
      />

      {error && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {lastImport &&
        (lastImport.imported.length > 0 ||
          lastImport.errors.length > 0 ||
          lastImport.duplicates.length > 0) && (
          <Card className="mb-4 space-y-2 p-4 text-sm" role="status" aria-label="Import result">
            {lastImport.imported.length > 0 && (
              <p className="flex items-center gap-2 text-success">
                <CircleCheck className="size-4" aria-hidden />
                Added {lastImport.imported.length} file{lastImport.imported.length === 1 ? '' : 's'}{' '}
                to the library.
              </p>
            )}
            {lastImport.duplicates.map((d) => (
              <p key={d.token} className="flex flex-wrap items-center gap-2">
                <span>
                  <span className="font-medium">{d.name}</span> is already in the library as “
                  {d.existingTitle}”.
                </span>
                <Button size="sm" variant="secondary" onClick={() => void addDuplicate(d.token)}>
                  Add anyway
                </Button>
              </p>
            ))}
            {lastImport.errors.map((e, i) => (
              <p key={i} className="text-primary">
                <span className="font-medium">{e.name}:</span> {e.reason}
              </p>
            ))}
          </Card>
        )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card>
          <div className="space-y-2 border-b border-border p-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, tags, descriptions and text"
                aria-label="Search resources"
                className={controlClasses(false, 'h-9 pl-9')}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                aria-label="Filter by subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={controlClasses(false, 'h-9 text-xs')}
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Filter by grade level"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className={controlClasses(false, 'h-9 text-xs')}
              >
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <select
                aria-label="Filter by tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className={controlClasses(false, 'h-9 text-xs')}
              >
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          {shown === null ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {filtered
                ? 'No resources match your search.'
                : 'No resources yet. Use “Add files” to import DOCX, PDF, TXT or Markdown files.'}
            </p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Resources">
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    aria-current={r.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors',
                      r.id === selectedId ? 'bg-primary-soft' : 'hover:bg-surface-muted',
                    )}
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[r.subject, r.gradeLevel].filter(Boolean).join(' · ') || 'No subject'} ·{' '}
                        {formatRelativeTime(new Date(r.updatedAt))}
                      </span>
                      {r.tags.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {r.tags.map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                        </span>
                      )}
                    </span>
                    <Badge>{r.kind.toUpperCase()}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selectedId ? (
          <ResourceDetailPanel
            key={selectedId}
            id={selectedId}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null)
              refresh()
            }}
          />
        ) : (
          <Card className="px-6 py-14 text-center text-sm text-muted-foreground">
            Select a resource to see its details and a preview.
          </Card>
        )}
      </div>
      <datalist id="res-subjects">
        {SUBJECT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  )
}

function ResourceDetailPanel({
  id,
  onChanged,
  onDeleted,
}: {
  id: string
  onChanged: () => void
  onDeleted: () => void
}) {
  const [detail, setDetail] = useState<ResourceDetail | null>(null)
  const [draft, setDraft] = useState({
    title: '',
    subject: '',
    gradeLevel: '',
    tags: '',
    description: '',
  })
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    teachmate.resources
      .get(id)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setDraft({
          title: d.title,
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          tags: d.tags.join(', '),
          description: d.description,
        })
      })
      .catch((err: unknown) => !cancelled && setStatus({ ok: false, text: ipcErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [id])

  if (!detail) {
    return <Card className="p-5 text-sm text-muted-foreground">{status?.text ?? 'Loading…'}</Card>
  }

  const titleError = draft.title.trim() ? undefined : 'Title is required.'
  const dirty =
    draft.title !== detail.title ||
    draft.subject !== detail.subject ||
    draft.gradeLevel !== detail.gradeLevel ||
    draft.description !== detail.description ||
    parseTagInput(draft.tags).join('|') !== detail.tags.join('|')

  const save = () => {
    teachmate.resources
      .update(id, { ...draft, tags: parseTagInput(draft.tags) })
      .then((meta) => {
        setDetail({ ...detail, ...meta })
        setDraft((d) => ({ ...d, title: meta.title, tags: meta.tags.join(', ') }))
        setStatus({ ok: true, text: 'Saved.' })
        onChanged()
      })
      .catch((err: unknown) => setStatus({ ok: false, text: ipcErrorMessage(err) }))
  }

  const preview = detail.text.slice(0, PREVIEW_CHARS)

  return (
    <div className="min-w-0 space-y-4">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge>{detail.kind.toUpperCase()}</Badge>
          <span className="truncate" title={detail.originalName}>
            {detail.originalName}
          </span>
          <span>· {formatSize(detail.size)}</span>
          <span>· {detail.charCount.toLocaleString()} characters of text</span>
        </div>
        <Field label="Title" htmlFor="res-title" required error={titleError}>
          <input
            {...a11y('res-title', titleError)}
            value={draft.title}
            maxLength={RESOURCE_LIMITS.titleMaxChars}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className={controlClasses(!!titleError, 'h-10')}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Subject" htmlFor="res-subject">
            <input
              {...a11y('res-subject')}
              list="res-subjects"
              value={draft.subject}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className={controlClasses(false, 'h-10')}
            />
          </Field>
          <Field label="Grade level" htmlFor="res-grade">
            <select
              {...a11y('res-grade')}
              value={draft.gradeLevel}
              onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value })}
              className={controlClasses(false, 'h-10')}
            >
              <option value="">Not set</option>
              {!GRADE_LEVELS.includes(draft.gradeLevel) && draft.gradeLevel && (
                <option>{draft.gradeLevel}</option>
              )}
              {GRADE_LEVELS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Tags"
          htmlFor="res-tags"
          hint={`Separate with commas, up to ${RESOURCE_LIMITS.tagsMax}.`}
        >
          <div className="relative">
            <Tag
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              {...a11y('res-tags', undefined, true)}
              value={draft.tags}
              placeholder="e.g. DLL, week 3, recycling"
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              className={controlClasses(false, 'h-10 pl-9')}
            />
          </div>
        </Field>
        <Field label="Description" htmlFor="res-description">
          <textarea
            {...a11y('res-description')}
            value={draft.description}
            rows={3}
            maxLength={RESOURCE_LIMITS.descriptionMaxChars}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={controlClasses(false, 'resize-y py-2 leading-6')}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!dirty || !!titleError} onClick={save}>
            <Save className="size-4" aria-hidden />
            Save details
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              teachmate.resources
                .openOriginal(id)
                .then(
                  (r) =>
                    !r.ok && setStatus({ ok: false, text: r.error ?? 'Could not open the file.' }),
                )
                .catch((err: unknown) => setStatus({ ok: false, text: ipcErrorMessage(err) }))
            }
          >
            <ExternalLink className="size-4" aria-hidden />
            Open original
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void teachmate.resources.reveal(id)}>
            <FolderOpen className="size-4" aria-hidden />
            Show in folder
          </Button>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete resource"
            title="Delete resource"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
        {status && (
          <p role="status" className={cn('text-xs', status.ok ? 'text-success' : 'text-primary')}>
            {status.text}
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Preview</h2>
          <span className="text-xs text-muted-foreground">
            {detail.kind === 'md' ? 'Rendered Markdown' : 'Extracted text'}
            {detail.text.length > PREVIEW_CHARS &&
              ` · first ${PREVIEW_CHARS.toLocaleString()} characters`}
          </span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4" data-role="resource-preview">
          {detail.kind === 'md' ? (
            <Markdown>{preview}</Markdown>
          ) : (
            <pre className="font-sans text-sm leading-6 whitespace-pre-wrap">{preview}</pre>
          )}
        </div>
      </Card>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this resource?"
        description={`“${detail.title}” and its stored copy of “${detail.originalName}” will be removed from TeachMate. The file on your computer where you added it from is not affected.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmDelete(false)
                teachmate.resources
                  .delete(id)
                  .then(onDeleted)
                  .catch((err: unknown) => setStatus({ ok: false, text: ipcErrorMessage(err) }))
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          </>
        }
      />
    </div>
  )
}
