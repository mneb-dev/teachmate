import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  CircleCheck,
  Clock,
  Eye,
  ListPlus,
  NotebookPen,
  RefreshCw,
  Shapes,
  Shuffle,
  TriangleAlert,
} from 'lucide-react'
import {
  ACTIVITY_LIMITS,
  instructionsText,
  parseActivities,
  type ActivityScope,
} from '@shared/activities'
import type { ProviderInfo } from '@shared/ai'
import type { DocumentPromptPreview, TeachingDocument } from '@shared/documents'
import { controlClasses } from '@renderer/components/form/styles'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardHeader } from '@renderer/components/ui/Card'
import { CopyButton } from '@renderer/components/ui/CopyButton'
import { Dialog } from '@renderer/components/ui/Dialog'
import { IconButton } from '@renderer/components/ui/IconButton'
import { IconTile } from '@renderer/components/ui/IconTile'
import { OpenSavedDialog } from '@renderer/features/documents/OpenSavedDialog'
import { PromptPreviewDialog } from '@renderer/features/documents/PromptPreviewDialog'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { cn } from '@renderer/lib/cn'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

/**
 * Per-activity tools: select activities, copy instructions, regenerate one
 * activity, ask for alternatives, and add selected activities to a lesson plan.
 */
export function ActivityManager({
  editor,
  provider,
}: {
  editor: DocumentEditor
  provider: ProviderInfo | null
}) {
  const navigate = useNavigate()
  const doc = editor.doc
  const content = doc?.content ?? ''
  const blocks = useMemo(() => parseActivities(content), [content])
  const [picked, setPicked] = useState<number[]>([])
  const [regenerate, setRegenerate] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [altCount, setAltCount] = useState(2)
  const [preview, setPreview] = useState<{
    data: DocumentPromptPreview
    scope: ActivityScope
  } | null>(null)
  const [choosePlan, setChoosePlan] = useState(false)
  const [added, setAdded] = useState<TeachingDocument | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  if (!doc || doc.kind !== 'learning-activities') return null

  // Selections refer to positions; drop any that no longer exist.
  const selected = picked.filter((p) => p <= blocks.length)
  const busy = editor.busy !== null
  const handoff = provider?.capabilities.returnsResponse === false
  const totalMinutes = blocks.reduce((a, b) => a + (b.minutes ?? 0), 0)
  const overTime = totalMinutes > doc.inputs.durationMinutes

  const toggle = (position: number) =>
    setPicked((current) =>
      current.includes(position) ? current.filter((p) => p !== position) : [...current, position],
    )

  const run = (scope: ActivityScope, instruction?: string) =>
    void editor.generate(provider, 'generate', instruction, scope)

  const regenerateScope: ActivityScope | null =
    regenerate === null ? null : { type: 'activity', index: regenerate }

  const addToPlan = async (planId: string) => {
    setChoosePlan(false)
    setAddError(null)
    setAdded(null)
    // The main process reads the saved activities, so save the latest edits first.
    const saved = await editor.save()
    if (!saved) return
    try {
      const plan = await teachmate.documents.addActivitiesToLessonPlan(
        saved.id,
        [...selected].sort((a, b) => a - b),
        planId,
      )
      setAdded(plan)
    } catch (err) {
      setAddError(ipcErrorMessage(err))
    }
  }

  if (blocks.length === 0) return null

  return (
    <Card aria-label="Activities">
      <CardHeader
        title={`Activities (${blocks.length})`}
        description="Select activities to add to a lesson plan, copy their instructions, or rework one at a time."
        icon={<IconTile icon={Shapes} size="sm" tone="muted" />}
        action={
          <Badge tone={overTime ? 'primary' : 'success'} title="Sum of the estimated durations">
            <Clock className="size-3" aria-hidden />
            {totalMinutes} / {doc.inputs.durationMinutes} min
          </Badge>
        }
      />

      <ul className="divide-y divide-border">
        {blocks.map((b) => {
          const checked = selected.includes(b.position)
          return (
            <li key={`${b.position}-${b.title}`} className="flex items-start gap-3 px-5 py-3">
              <input
                type="checkbox"
                className="mt-1 size-4 cursor-pointer accent-primary"
                checked={checked}
                onChange={() => toggle(b.position)}
                aria-label={`Select activity ${b.position}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">{b.position}.</span>{' '}
                  {b.title || `Activity ${b.position}`}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {b.type && <Badge>{b.type.replace(/\*+/g, '')}</Badge>}
                  {b.minutes !== null && (
                    <Badge>
                      <Clock className="size-3" aria-hidden />
                      {b.minutes} min
                    </Badge>
                  )}
                  {b.missing.length > 0 && (
                    <Badge tone="primary" title={`Missing: ${b.missing.join(', ')}`}>
                      <TriangleAlert className="size-3" aria-hidden />
                      {b.missing.length} part{b.missing.length === 1 ? '' : 's'} missing
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <CopyButton
                  text={instructionsText(b)}
                  label={`Copy instructions for activity ${b.position}`}
                />
                <IconButton
                  label={`Regenerate activity ${b.position}`}
                  disabled={busy || !provider}
                  onClick={() => {
                    setNote('')
                    setRegenerate(b.position)
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        <label htmlFor="alt-count" className="text-sm text-muted-foreground">
          Alternatives
        </label>
        <select
          id="alt-count"
          value={altCount}
          onChange={(e) => setAltCount(Number(e.target.value))}
          className={controlClasses(false, 'h-8 w-16')}
        >
          {Array.from({ length: ACTIVITY_LIMITS.maxAlternatives }, (_, k) => k + 1).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !provider}
          onClick={() => run({ type: 'alternatives', count: altCount })}
          title="New activities using different approaches; they are added after the current ones"
        >
          <Shuffle className="size-4" aria-hidden />
          Generate alternatives
        </Button>
        <span className="flex-1" />
        <Button
          size="sm"
          disabled={selected.length === 0 || busy}
          onClick={() => {
            setAdded(null)
            setAddError(null)
            setChoosePlan(true)
          }}
        >
          <ListPlus className="size-4" aria-hidden />
          Add {selected.length > 0 ? selected.length : ''} to lesson plan
        </Button>
      </div>

      {(added || addError) && (
        <div
          role="status"
          className={cn(
            'flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 text-sm',
            addError && 'text-primary',
          )}
        >
          {added ? (
            <>
              <CircleCheck className="size-4 text-success" aria-hidden />
              <span className="min-w-0 flex-1">
                Added to “{added.title}” as a new “Learning Activities” section at the end. Its
                previous version is kept in history.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/lesson-planner?d=${encodeURIComponent(added.id)}`)}
              >
                <NotebookPen className="size-4" aria-hidden />
                Open lesson plan
              </Button>
            </>
          ) : (
            <>
              <TriangleAlert className="size-4" aria-hidden />
              {addError}
            </>
          )}
        </div>
      )}

      <Dialog
        open={regenerate !== null}
        onClose={() => setRegenerate(null)}
        title={`Regenerate activity ${regenerate ?? ''}`}
        description="Only this activity is replaced; the others stay as they are. The current version is kept in history."
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                const scope = regenerateScope
                if (!scope) return
                void editor
                  .previewPrompt('generate', note, scope)
                  .then((p) => p && setPreview({ data: p, scope }))
              }}
            >
              <Eye className="size-4" aria-hidden />
              Preview prompt
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                if (regenerateScope) run(regenerateScope, note)
                setRegenerate(null)
              }}
            >
              <RefreshCw className="size-4" aria-hidden />
              {handoff ? 'Send to Claude Code' : 'Regenerate'}
            </Button>
          </>
        }
      >
        <label htmlFor="regenerate-note" className="text-sm font-medium">
          What should change? (optional)
        </label>
        <textarea
          id="regenerate-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="e.g. Make it work without electricity, and shorten it to 10 minutes."
          className={controlClasses(false, 'mt-1.5 resize-y py-2 leading-6')}
        />
      </Dialog>

      <PromptPreviewDialog
        preview={preview?.data ?? null}
        onClose={() => setPreview(null)}
        sendLabel={handoff ? 'Send to Claude Code' : 'Regenerate'}
        onSend={() => {
          const scope = preview?.scope
          setPreview(null)
          setRegenerate(null)
          if (scope) run(scope, note)
        }}
      />

      <OpenSavedDialog
        open={choosePlan}
        kind="lesson-plan"
        noun="lesson plan"
        title={`Add ${selected.length} activit${selected.length === 1 ? 'y' : 'ies'} to a lesson plan`}
        onClose={() => setChoosePlan(false)}
        onOpen={(id) => void addToPlan(id)}
      />
    </Card>
  )
}
