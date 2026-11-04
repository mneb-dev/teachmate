import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Columns2,
  Eye,
  FilePenLine,
  GitCompare,
  NotebookPen,
  Pencil,
  Save,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { ProviderInfo } from '@shared/ai'
import { findUnverifiedCodes } from '@shared/document-rules'
import { trustedSourceText } from '@shared/document-text'
import type { DocumentPromptPreview } from '@shared/documents'
import {
  REVIEW_LIMITS,
  REVISION_TARGETS,
  REVISION_TARGET_IDS,
  diffLines,
  type RevisedLessonPlan,
  type ReviewScope,
  type RevisionTarget,
} from '@shared/review'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardHeader } from '@renderer/components/ui/Card'
import { CopyButton } from '@renderer/components/ui/CopyButton'
import { IconButton } from '@renderer/components/ui/IconButton'
import { IconTile } from '@renderer/components/ui/IconTile'
import { Markdown } from '@renderer/components/ui/Markdown'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import { PromptPreviewDialog } from '@renderer/features/documents/PromptPreviewDialog'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { cn } from '@renderer/lib/cn'
import { formatRelativeTime } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

type View = 'revised' | 'side' | 'changes' | 'edit'

const SOURCE_LABEL: Record<RevisedLessonPlan['source'], string> = {
  provider: 'Generated',
  pasted: 'Pasted',
  edited: 'Edited by you',
}

function revisionName(r: RevisedLessonPlan): string {
  const what =
    r.target === 'sections' && r.sections
      ? `sections: ${r.sections}`
      : REVISION_TARGETS[r.target].short
  return `${what[0].toUpperCase()}${what.slice(1)}${r.base === 'revision' ? ' (on earlier revision)' : ''}`
}

/**
 * Request revised versions of the reviewed plan and compare them with the
 * original. Revisions are stored with the review; the original lesson plan
 * is never replaced. A revision can be saved as a new lesson plan.
 */
export function RevisedPlanPanel({
  editor,
  provider,
}: {
  editor: DocumentEditor
  provider: ProviderInfo | null
}) {
  const navigate = useNavigate()
  const [target, setTarget] = useState<RevisionTarget>('objectives')
  const [sections, setSections] = useState('')
  const [base, setBase] = useState<'original' | 'revision'>('original')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<DocumentPromptPreview | null>(null)
  const [picked, setPicked] = useState<{ id: string; newest: string } | null>(null)
  const [view, setView] = useState<View>('revised')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const doc = editor.doc
  const revisions = doc?.kind === 'lesson-plan-review' ? doc.revisions : []
  const newest = revisions[0]
  // Show the teacher's pick until a newer revision arrives, then the newest.
  const current =
    (picked && picked.newest === newest?.id && revisions.find((r) => r.id === picked.id)) || newest
  const original = doc?.kind === 'lesson-plan-review' ? (doc.inputs.source?.text ?? '') : ''
  const diff = useMemo(
    () => (current && view === 'changes' ? diffLines(original, current.content) : null),
    [current, original, view],
  )

  if (!doc || doc.kind !== 'lesson-plan-review') return null

  const busy = editor.busy !== null
  const handoff = provider?.capabilities.returnsResponse === false
  const effectiveBase = revisions.length > 0 ? base : 'original'
  const scope: ReviewScope = {
    type: 'revision',
    target,
    base: effectiveBase,
    ...(target === 'sections' ? { sections: sections.trim() } : {}),
  }
  const canRequest = !busy && !!provider && (target !== 'sections' || sections.trim().length > 0)
  const run = () => void editor.generate(provider, 'generate', note.trim() || undefined, scope)

  const codes = current ? findUnverifiedCodes(current.content, trustedSourceText(doc)) : []

  const updateRevision = (id: string, patch: Partial<RevisedLessonPlan>) =>
    editor.update((d) =>
      d.kind === 'lesson-plan-review'
        ? { ...d, revisions: d.revisions.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
        : d,
    )

  const saveAsPlan = async (revision: RevisedLessonPlan) => {
    setSaveError(null)
    setSavingId(revision.id)
    try {
      // The main process reads the saved review, so save edits first.
      const saved = await editor.save()
      if (!saved) return
      const plan = await teachmate.documents.saveRevisionAsLessonPlan(saved.id, revision.id)
      updateRevision(revision.id, { savedAsId: plan.id })
    } catch (err) {
      setSaveError(ipcErrorMessage(err))
    } finally {
      setSavingId(null)
    }
  }

  const sendLabel = handoff ? 'Send to Claude Code' : 'Generate revision'

  return (
    <Card aria-label="Revised lesson plan">
      <CardHeader
        title="Revised lesson plan"
        description="Improve the plan using the review. Revisions are kept separately; the original lesson plan is never replaced."
        icon={<IconTile icon={FilePenLine} size="sm" tone="muted" />}
      />
      <div className="space-y-4 p-5 pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="rv-target" className="mb-1.5 block text-sm font-medium">
              What to improve
            </label>
            <select
              {...a11y('rv-target')}
              value={target}
              disabled={busy}
              onChange={(e) => setTarget(e.target.value as RevisionTarget)}
              className={controlClasses(false, 'h-10')}
            >
              {REVISION_TARGET_IDS.map((t) => (
                <option key={t} value={t}>
                  {REVISION_TARGETS[t].label}
                </option>
              ))}
            </select>
          </div>
          {target === 'sections' && (
            <div>
              <label htmlFor="rv-sections" className="mb-1.5 block text-sm font-medium">
                Sections to improve
              </label>
              <input
                id="rv-sections"
                value={sections}
                disabled={busy}
                maxLength={REVIEW_LIMITS.sectionsMaxChars}
                placeholder="e.g. IV. Procedures B–D"
                onChange={(e) => setSections(e.target.value)}
                className={controlClasses(false, 'h-10')}
              />
            </div>
          )}
        </div>
        {revisions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Start from</span>
            <SegmentedControl<'original' | 'revision'>
              label="Start from"
              value={base}
              onChange={setBase}
              options={[
                { value: 'original', label: 'Original plan' },
                { value: 'revision', label: 'Latest revision' },
              ]}
            />
          </div>
        )}
        <div>
          <label htmlFor="rv-note" className="mb-1.5 block text-sm font-medium">
            Note for the revision (optional)
          </label>
          <textarea
            id="rv-note"
            value={note}
            rows={2}
            maxLength={4000}
            disabled={busy}
            placeholder="e.g. Keep the group activity but shorten it to 15 minutes."
            onChange={(e) => setNote(e.target.value)}
            className={controlClasses(false, 'resize-y py-2 leading-6')}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canRequest}
            onClick={() =>
              void editor
                .previewPrompt('generate', note.trim() || undefined, scope)
                .then((p) => p && setPreview(p))
            }
          >
            <Eye className="size-4" aria-hidden />
            Preview prompt
          </Button>
          <Button size="sm" disabled={!canRequest} onClick={run}>
            {handoff ? (
              <Send className="size-4" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {sendLabel}
          </Button>
        </div>

        {current && (
          <div className="space-y-3 border-t border-border pt-4" data-role="revision">
            <div className="flex flex-wrap items-center gap-2">
              {revisions.length > 1 ? (
                <select
                  aria-label="Revised version"
                  value={current.id}
                  onChange={(e) => setPicked({ id: e.target.value, newest: newest.id })}
                  className={controlClasses(false, 'h-9 min-w-0 flex-1 sm:max-w-md')}
                >
                  {revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {revisionName(r)} · {formatRelativeTime(new Date(r.createdAt))}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-medium">{revisionName(current)}</span>
              )}
              <Badge>{SOURCE_LABEL[current.source]}</Badge>
              {current.savedAsId && <Badge tone="success">Saved as a lesson plan</Badge>}
              {revisions.length <= 1 && <span className="flex-1" />}
              <CopyButton text={current.content} label="Copy revised plan" />
              <IconButton
                label="Delete this revised version"
                onClick={() =>
                  window.confirm(
                    'Delete this revised version? The original plan is not affected.',
                  ) &&
                  editor.update((d) =>
                    d.kind === 'lesson-plan-review'
                      ? { ...d, revisions: d.revisions.filter((r) => r.id !== current.id) }
                      : d,
                  )
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </div>

            <SegmentedControl<View>
              label="Compare"
              value={view}
              onChange={setView}
              options={[
                { value: 'revised', label: 'Revised', icon: Eye },
                { value: 'side', label: 'Side by side', icon: Columns2 },
                { value: 'changes', label: 'Changes', icon: GitCompare },
                { value: 'edit', label: 'Edit', icon: Pencil },
              ]}
            />

            {view === 'revised' && (
              <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border px-5 py-4">
                <Markdown>{current.content}</Markdown>
              </div>
            )}

            {view === 'side' && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-role="side-by-side">
                <section aria-label="Original lesson plan">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
                  <pre className="max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-surface-muted p-4 font-sans text-xs leading-5 whitespace-pre-wrap">
                    {original}
                  </pre>
                </section>
                <section aria-label="Revised lesson plan">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Revised</p>
                  <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border px-4 py-3">
                    <Markdown>{current.content}</Markdown>
                  </div>
                </section>
              </div>
            )}

            {view === 'changes' &&
              (diff ? (
                <div data-role="changes">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {diff.filter((l) => l.type === 'added').length} lines added or changed ·{' '}
                    {diff.filter((l) => l.type === 'removed').length} lines removed or replaced.
                    Formatting differences are ignored.
                  </p>
                  <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border font-mono text-xs leading-5">
                    {diff.map((l, k) => (
                      <div
                        key={k}
                        data-diff={l.type}
                        className={cn(
                          'flex gap-2 px-3 whitespace-pre-wrap',
                          l.type === 'added' && 'bg-success-soft text-foreground',
                          l.type === 'removed' &&
                            'bg-primary-soft text-muted-foreground line-through',
                        )}
                      >
                        <span aria-hidden className="w-3 shrink-0 select-none">
                          {l.type === 'added' ? '+' : l.type === 'removed' ? '−' : ''}
                        </span>
                        <span className="sr-only">
                          {l.type === 'added' ? 'Added: ' : l.type === 'removed' ? 'Removed: ' : ''}
                        </span>
                        <span className="min-w-0 flex-1">{l.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  These plans are too long to compare line by line. Use Side by side instead.
                </p>
              ))}

            {view === 'edit' && (
              <textarea
                value={current.content}
                aria-label="Edit revised lesson plan (Markdown)"
                onChange={(e) =>
                  updateRevision(current.id, { content: e.target.value, source: 'edited' })
                }
                className="block h-[60vh] w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 font-mono text-xs leading-6 focus:outline-none"
              />
            )}

            {current.notes && (
              <details className="rounded-xl border border-border px-4 py-2 text-sm">
                <summary className="cursor-pointer font-medium">Summary of changes</summary>
                <div className="mt-2">
                  <Markdown>{current.notes}</Markdown>
                </div>
              </details>
            )}

            {codes.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-primary/30 bg-primary-soft/60 p-3 text-xs">
                {codes.map((w) => (
                  <li key={w.match} className="flex gap-2">
                    <TriangleAlert className="size-3.5 shrink-0 text-primary" aria-hidden />
                    {w.message}
                  </li>
                ))}
              </ul>
            )}

            {saveError && (
              <p role="alert" className="text-sm text-primary">
                {saveError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {current.savedAsId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigate(`/lesson-planner?d=${encodeURIComponent(current.savedAsId!)}`)
                  }
                >
                  <NotebookPen className="size-4" aria-hidden />
                  Open revised lesson plan
                </Button>
              )}
              <Button
                size="sm"
                variant={current.savedAsId ? 'secondary' : 'primary'}
                disabled={busy || savingId !== null || !current.content.trim()}
                onClick={() => void saveAsPlan(current)}
              >
                <Save className="size-4" aria-hidden />
                {current.savedAsId ? 'Save another copy' : 'Save as new lesson plan'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <PromptPreviewDialog
        preview={preview}
        onClose={() => setPreview(null)}
        sendLabel={sendLabel}
        onSend={() => {
          setPreview(null)
          run()
        }}
      />
    </Card>
  )
}
