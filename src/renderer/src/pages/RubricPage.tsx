import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  CircleCheck,
  ClipboardPaste,
  Eye,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  Save,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { calculationErrors, extractAssessmentCriteria } from '@shared/calculation-rules'
import type { DocumentPromptPreview, TeachingDocument } from '@shared/documents'
import { defaultRubric, renderRubricMarkdown, type RubricData } from '@shared/rubric'
import { getNavItem } from '@renderer/app/navigation'
import { HandoffPanel } from '@renderer/components/ai/HandoffPanel'
import { PasteReplyDialog } from '@renderer/components/ai/PasteReplyDialog'
import { controlClasses } from '@renderer/components/form/styles'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'
import { CopyButton } from '@renderer/components/ui/CopyButton'
import { Dialog } from '@renderer/components/ui/Dialog'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { ExportDocxButton } from '@renderer/features/documents/ExportDocxButton'
import { OpenSavedDialog } from '@renderer/features/documents/OpenSavedDialog'
import { PromptPreviewDialog } from '@renderer/features/documents/PromptPreviewDialog'
import { useDocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { RubricEditor } from '@renderer/features/rubric/RubricEditor'
import { RubricSettings } from '@renderer/features/rubric/RubricSettings'
import { ScoreSummary } from '@renderer/features/rubric/ScoreSummary'
import { useSelectedProvider } from '@renderer/hooks/useSelectedProvider'
import { teachmate } from '@renderer/lib/ipc'

type RubricDoc = Extract<TeachingDocument, { kind: 'rubric' }>

/** `?fromTask=<id>`: start a rubric from a saved performance task and its assessment criteria. */
function presetFromParams(params: URLSearchParams) {
  const taskId = params.get('fromTask')
  if (!taskId) return undefined
  return async (doc: TeachingDocument): Promise<TeachingDocument> => {
    if (doc.kind !== 'rubric') return doc
    const task = await teachmate.documents.get(taskId)
    if (!task || task.kind !== 'performance-task' || !task.content.trim()) {
      throw new Error(
        'That performance task could not be used. Open it and make sure it has content.',
      )
    }
    const title = task.content.match(/^#\s+(.+)$/m)?.[1]?.trim() || task.inputs.topic
    const names = extractAssessmentCriteria(task.content)
    const levelCount = doc.inputs.levelCount
    const criteria = names.length > 0 ? names : ['', '', '', '']
    return {
      ...doc,
      inputs: {
        ...doc.inputs,
        subject: task.inputs.subject,
        gradeLevel: task.inputs.gradeLevel,
        competency: task.inputs.competency,
        competencyCode: task.inputs.competencyCode,
        taskTitle: title,
        criteriaCount: criteria.length,
        // Highest level × one weight per criterion keeps the total valid from the start.
        targetTotal: levelCount * criteria.length,
        task: { sourceId: task.id, title, text: task.content.slice(0, 20_000) },
      },
      rubric: defaultRubric(levelCount, levelCount * criteria.length, criteria),
    }
  }
}

export function RubricPage() {
  const nav = getNavItem('rubrics')
  const [params, setParams] = useSearchParams()
  const documentId = params.get('d')
  const onIdChange = useCallback(
    (id: string | null) => setParams(id ? { d: id } : {}, { replace: true }),
    [setParams],
  )
  const preset = presetFromParams(params)
  const editor = useDocumentEditor({ kind: 'rubric', documentId, onIdChange, preset })
  const { provider } = useSelectedProvider()
  const [openSaved, setOpenSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [preview, setPreview] = useState<{
    p: DocumentPromptPreview
    action: 'generate' | 'revise'
  } | null>(null)
  const [pasteFor, setPasteFor] = useState<{ recordId: string | null } | null>(null)
  const [revision, setRevision] = useState('')

  const doc = editor.doc?.kind === 'rubric' ? (editor.doc as RubricDoc) : null
  const problems = doc ? calculationErrors(doc) : []
  const busy = editor.busy !== null
  const handoff = provider?.capabilities.returnsResponse === false
  const latest = doc?.requests[0]
  const awaiting = latest?.status === 'awaiting-reply' && latest.handoff ? latest : null
  const hasText = doc
    ? doc.rubric.type === 'analytic'
      ? doc.rubric.criteria.some((c) => c.descriptors.some((d) => d.trim()))
      : doc.rubric.holistic.some((h) => h.description.trim())
    : false

  const setRubric = (fn: (r: RubricData) => RubricData) =>
    editor.update((d) => (d.kind === 'rubric' ? { ...d, rubric: fn(d.rubric) } : d))

  const confirmDiscard = () =>
    !editor.dirty || !editor.persisted || window.confirm('You have unsaved changes. Discard them?')

  const generate = (action: 'generate' | 'revise') =>
    void editor.generate(provider, action, action === 'revise' ? revision : undefined).then((r) => {
      if (r && action === 'revise') setRevision('')
    })

  return (
    <>
      <PageHeader
        title={nav.label}
        description="Analytic or holistic rubrics with 4 or 5 levels — points and totals are calculated for you."
        icon={nav.icon}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => confirmDiscard() && setOpenSaved(true)}
            >
              <FolderOpen className="size-4" aria-hidden />
              Open saved
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => confirmDiscard() && editor.startNew()}
            >
              <FilePlus2 className="size-4" aria-hidden />
              New rubric
            </Button>
          </>
        }
      />

      {editor.load.status === 'loading' && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading…
        </div>
      )}
      {editor.load.status === 'error' && (
        <Card className="mx-auto max-w-md p-8 text-center">
          <TriangleAlert className="mx-auto size-6 text-primary" aria-hidden />
          <p className="mt-2 text-sm font-medium">Couldn’t open this rubric</p>
          <p className="mt-1 text-sm text-muted-foreground">{editor.load.error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={editor.startNew}>
            Start a new rubric
          </Button>
        </Card>
      )}

      {editor.load.status === 'ready' && doc && (
        <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <Card className="space-y-4 p-5">
            <RubricSettings editor={editor} />
            <div className="space-y-2 border-t border-border pt-4">
              {provider && (
                <p className="text-xs text-muted-foreground">
                  The AI drafts criteria and descriptions only — TeachMate sets every number.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void editor
                      .previewPrompt('generate')
                      .then((p) => p && setPreview({ p, action: 'generate' }))
                  }
                >
                  <Eye className="size-4" aria-hidden />
                  Preview prompt
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={busy || !provider}
                  onClick={() => generate('generate')}
                >
                  {editor.busy === 'generating' ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {handoff ? 'Draft with Claude Code' : 'Draft with AI'}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPasteFor({ recordId: null })}>
                <ClipboardPaste className="size-4" aria-hidden />
                Paste a rubric table
              </Button>
            </div>
          </Card>

          <div className="min-w-0 space-y-4">
            <Card className="p-4">
              <label htmlFor="doc-title" className="sr-only">
                Document title
              </label>
              <input
                id="doc-title"
                value={doc.title}
                maxLength={160}
                onChange={(ev) => editor.setTitle(ev.target.value)}
                className="-mx-2 block h-9 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold hover:border-border focus:border-primary/60 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {problems.length > 0 ? (
                  <Badge tone="primary">Points don’t add up</Badge>
                ) : !editor.persisted ? (
                  <Badge>Not saved yet</Badge>
                ) : editor.dirty ? (
                  <Badge tone="primary">Unsaved changes</Badge>
                ) : (
                  <Badge tone="success">
                    <CircleCheck className="size-3" aria-hidden />
                    Saved
                  </Badge>
                )}
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant={editor.dirty ? 'primary' : 'secondary'}
                  disabled={busy || problems.length > 0}
                  title={problems.length > 0 ? 'Fix the points before saving' : undefined}
                  onClick={() => void editor.save()}
                >
                  <Save className="size-4" aria-hidden />
                  Save
                </Button>
                {problems.length === 0 && (
                  <CopyButton
                    text={renderRubricMarkdown(doc.title, doc.rubric)}
                    label="Copy as Markdown"
                  />
                )}
                <ExportDocxButton editor={editor} disabled={problems.length > 0} />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Delete rubric"
                  title="Delete rubric"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </Card>

            {editor.error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex-1">{editor.error}</span>
                <button
                  type="button"
                  className="cursor-pointer text-xs font-medium hover:underline"
                  onClick={() => editor.setError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {awaiting?.handoff && editor.busy !== 'generating' && (
              <HandoffPanel
                handoff={awaiting.handoff}
                createdAt={awaiting.createdAt}
                busy={busy}
                context="document"
                title={
                  awaiting.action === 'revise'
                    ? 'Revision sent to Claude Code'
                    : 'Continue in Claude Code'
                }
                onPasteReply={() => setPasteFor({ recordId: awaiting.id })}
                onPrepareAgain={() =>
                  void editor.generate(provider, awaiting.action, awaiting.instruction)
                }
              />
            )}

            <Card className="p-4">
              <RubricEditor rubric={doc.rubric} onChange={setRubric} />
            </Card>

            <ScoreSummary
              rubric={doc.rubric}
              levelCount={doc.inputs.levelCount}
              targetTotal={doc.inputs.targetTotal}
              onChange={setRubric}
            />

            {hasText && (
              <Card className="p-4">
                <label htmlFor="revision" className="text-sm font-medium">
                  Ask for changes
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The current rubric is sent along. Scores and weights stay as you set them.
                </p>
                <textarea
                  id="revision"
                  value={revision}
                  onChange={(ev) => setRevision(ev.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="e.g. Make the descriptions simpler for Grade 8 learners."
                  className={controlClasses(false, 'mt-2 resize-y py-2 leading-6')}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!revision.trim() || busy}
                    onClick={() =>
                      void editor
                        .previewPrompt('revise', revision)
                        .then((p) => p && setPreview({ p, action: 'revise' }))
                    }
                  >
                    <Eye className="size-4" aria-hidden />
                    Preview prompt
                  </Button>
                  <Button
                    size="sm"
                    disabled={!revision.trim() || busy}
                    onClick={() => generate('revise')}
                  >
                    <Send className="size-4" aria-hidden />
                    {handoff ? 'Send revision to Claude Code' : 'Revise'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      <PromptPreviewDialog
        preview={preview?.p ?? null}
        onClose={() => setPreview(null)}
        sendLabel={handoff ? 'Send to Claude Code' : 'Send'}
        onSend={() => {
          const action = preview?.action ?? 'generate'
          setPreview(null)
          generate(action)
        }}
      />
      <PasteReplyDialog
        open={pasteFor !== null}
        onClose={() => setPasteFor(null)}
        title={pasteFor?.recordId ? 'Paste Claude’s rubric' : 'Paste a rubric table'}
        description="Paste the Markdown table. TeachMate reads the criteria and descriptions into the rubric; any numbers in it are ignored, and the points stay as you set them."
        confirmLabel="Read into rubric"
        onSave={async (content) => {
          await editor.applyReply(pasteFor?.recordId ?? null, content)
          setPasteFor(null)
        }}
      />
      <OpenSavedDialog
        open={openSaved}
        kind="rubric"
        noun="rubric"
        onClose={() => setOpenSaved(false)}
        onOpen={(id) => {
          setOpenSaved(false)
          onIdChange(id)
        }}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this rubric?"
        description={`“${doc?.title ?? ''}” will be permanently removed from this device.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmDelete(false)
                void editor.remove()
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
