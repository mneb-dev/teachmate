import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  BookOpen,
  ClipboardPaste,
  ExternalLink,
  FileText,
  Library,
  LoaderCircle,
  Upload,
} from 'lucide-react'
import { wordCount } from '@shared/annotation'
import type { ReviewInputs } from '@shared/documents'
import {
  REVIEW_DEPTHS,
  REVIEW_FOCUSES,
  REVIEW_FOCUS_IDS,
  REVIEW_LIMITS,
  detectPlanType,
  type ReviewDepth,
  type ReviewFocus,
  type ReviewSource,
} from '@shared/review'
import {
  CURRICULUM_FRAMEWORKS,
  LESSON_PLAN_FORMATS,
  LESSON_PLAN_FORMAT_IDS,
  TEACHING_LANGUAGES,
  type CurriculumFramework,
  type LessonPlanFormat,
  type TeachingLanguage,
} from '@shared/teaching'
import { Field } from '@renderer/components/form/Field'
import { ReferencePicker } from '@renderer/components/form/ReferencePicker'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { LibraryPickerDialog } from '@renderer/components/library/LibraryPickerDialog'
import { Button } from '@renderer/components/ui/Button'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import { OpenSavedDialog } from '@renderer/features/documents/OpenSavedDialog'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

const ORIGIN_LABEL: Record<ReviewSource['origin'], string> = {
  resource: 'Uploaded file (kept in Teaching Resources)',
  document: 'Saved lesson plan',
  pasted: 'Pasted text',
}

/** Title for pasted text: its first line, shortened. */
function pastedTitle(text: string): string {
  const first = text
    .split('\n')
    .map((l) =>
      l
        .replace(/^[#>*\-\s|]+/, '')
        .replace(/[*_|]/g, '')
        .trim(),
    )
    .find(Boolean)
  return (first ?? 'Pasted lesson plan').slice(0, 120)
}

export function ReviewForm({ editor }: { editor: DocumentEditor }) {
  const navigate = useNavigate()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [showText, setShowText] = useState(false)

  const doc = editor.doc
  if (!doc || doc.kind !== 'lesson-plan-review') return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof ReviewInputs, string>>
  const disabled = editor.busy === 'generating'
  const detected = i.source ? detectPlanType(i.source.text) : null

  const set = <K extends keyof ReviewInputs>(key: K, value: ReviewInputs[K]) =>
    editor.update((d) =>
      d.kind === 'lesson-plan-review' ? { ...d, inputs: { ...d.inputs, [key]: value } } : d,
    )

  const applySource = (
    source: ReviewSource,
    extra: { subject?: string; gradeLevel?: string; planType?: LessonPlanFormat } = {},
  ) => {
    setSourceError(null)
    const planType = extra.planType ?? detectPlanType(source.text)
    editor.update((d) =>
      d.kind === 'lesson-plan-review'
        ? {
            ...d,
            inputs: {
              ...d.inputs,
              source,
              subject: extra.subject?.trim() || d.inputs.subject,
              gradeLevel: extra.gradeLevel?.trim() || d.inputs.gradeLevel,
              planType: planType ?? d.inputs.planType,
            },
          }
        : d,
    )
  }

  const fromResource = async (id: string) => {
    const r = await teachmate.resources.get(id)
    if (!r.text.trim()) throw new Error('That file has no readable text.')
    applySource(
      {
        origin: 'resource',
        refId: r.id,
        title: r.title,
        text: r.text.slice(0, REVIEW_LIMITS.sourceMaxChars),
        charCount: r.charCount,
      },
      { subject: r.subject, gradeLevel: r.gradeLevel },
    )
  }

  const upload = async () => {
    setUploading(true)
    setSourceError(null)
    try {
      const result = await teachmate.resources.import()
      const id = result.imported[0]?.id ?? result.duplicates[0]?.existingId
      if (id) await fromResource(id)
      else if (result.errors[0])
        setSourceError(`${result.errors[0].name}: ${result.errors[0].reason}`)
    } catch (err) {
      setSourceError(ipcErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const startPaste = () =>
    applySource({
      origin: 'pasted',
      refId: null,
      title: 'Pasted lesson plan',
      text: '',
      charCount: 0,
    })

  const setPasted = (text: string) => {
    const clipped = text.slice(0, REVIEW_LIMITS.sourceMaxChars)
    editor.update((d) =>
      d.kind === 'lesson-plan-review' && d.inputs.source
        ? {
            ...d,
            inputs: {
              ...d.inputs,
              source: {
                ...d.inputs.source,
                title: pastedTitle(clipped),
                text: clipped,
                charCount: clipped.length,
              },
            },
          }
        : d,
    )
  }

  const openOriginal = () => {
    if (!i.source?.refId) return
    if (i.source.origin === 'document') {
      navigate(`/lesson-planner?d=${encodeURIComponent(i.source.refId)}`)
    } else {
      void teachmate.resources
        .openOriginal(i.source.refId)
        .then((r) => !r.ok && setSourceError(r.error ?? 'Could not open the file.'))
    }
  }

  const pasted = i.source?.origin === 'pasted'

  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="sr-only">Lesson plan review details</legend>

      <Field label="Lesson plan to review" required error={e.source ?? sourceError ?? undefined}>
        {i.source && !pasted ? (
          <div className="rounded-xl border border-border p-3" data-role="review-source">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.source.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ORIGIN_LABEL[i.source.origin]} · {wordCount(i.source.text).toLocaleString()}{' '}
                  words — the whole plan is sent
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowText(!showText)}>
                {showText ? 'Hide' : 'Show'} text
              </Button>
            </div>
            {showText && (
              <pre className="mt-2 max-h-56 overflow-y-auto rounded-lg bg-surface-muted p-3 font-sans text-xs leading-5 whitespace-pre-wrap">
                {i.source.text}
              </pre>
            )}
            {i.source.refId && (
              <Button variant="ghost" size="sm" className="mt-1" onClick={openOriginal}>
                <ExternalLink className="size-4" aria-hidden />
                {i.source.origin === 'document'
                  ? 'Open original lesson plan'
                  : 'Open original file'}
              </Button>
            )}
          </div>
        ) : pasted ? (
          <>
            <textarea
              {...a11y('rv-paste', e.source, true)}
              value={i.source?.text ?? ''}
              rows={10}
              maxLength={REVIEW_LIMITS.sourceMaxChars}
              aria-label="Pasted lesson plan"
              placeholder="Paste the complete lesson plan here (objectives, content, resources, procedures, assessment…)."
              onChange={(ev) => setPasted(ev.target.value)}
              className={controlClasses(!!e.source, 'resize-y py-2 font-mono text-xs leading-5')}
            />
            <p id="rv-paste-hint" className="mt-1 text-xs text-muted-foreground">
              {wordCount(i.source?.text ?? '').toLocaleString()} words. The original stays exactly
              as pasted; revisions are kept separately.
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Upload a DOCX or PDF, choose a saved lesson plan, or paste the plan.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void upload()} disabled={uploading}>
            {uploading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            Upload DOCX / PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPlansOpen(true)}>
            <BookOpen className="size-4" aria-hidden />
            Saved lesson plan
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setLibraryOpen(true)}>
            <Library className="size-4" aria-hidden />
            From library
          </Button>
          {!pasted && (
            <Button variant="secondary" size="sm" onClick={startPaste}>
              <ClipboardPaste className="size-4" aria-hidden />
              Paste text
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Uploaded files are kept in Teaching Resources (DOCX, PDF, TXT or MD). The original is
          never changed.
        </p>
      </Field>

      <Field
        label="Type of lesson plan"
        htmlFor="rv-type"
        required
        error={e.planType}
        hint={
          detected
            ? detected === i.planType
              ? 'Detected from the plan.'
              : `The plan looks like a ${LESSON_PLAN_FORMATS[detected].label}.`
            : undefined
        }
      >
        <select
          {...a11y('rv-type', e.planType, !!detected)}
          value={i.planType}
          onChange={(ev) => set('planType', ev.target.value as LessonPlanFormat)}
          className={controlClasses(!!e.planType, 'h-10')}
        >
          {LESSON_PLAN_FORMAT_IDS.map((f) => (
            <option key={f} value={f}>
              {LESSON_PLAN_FORMATS[f].label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Subject (optional)" htmlFor="rv-subject" error={e.subject}>
          <input
            {...a11y('rv-subject', e.subject)}
            value={i.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
        </Field>
        <Field label="Grade level (optional)" htmlFor="rv-grade" error={e.gradeLevel}>
          <input
            {...a11y('rv-grade', e.gradeLevel)}
            value={i.gradeLevel}
            maxLength={500}
            onChange={(ev) => set('gradeLevel', ev.target.value)}
            className={controlClasses(!!e.gradeLevel, 'h-10')}
          />
        </Field>
      </div>

      <Field label="Review depth" hint={REVIEW_DEPTHS[i.depth].description}>
        <SegmentedControl<ReviewDepth>
          label="Review depth"
          value={i.depth}
          onChange={(v) => set('depth', v)}
          options={(Object.keys(REVIEW_DEPTHS) as ReviewDepth[]).map((d) => ({
            value: d,
            label: d === 'quick' ? 'Quick' : 'Comprehensive',
          }))}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Review focus"
          htmlFor="rv-focus"
          error={e.focus}
          hint={
            i.focus === 'overall'
              ? 'All criteria in equal depth.'
              : `Most detail on criteria ${REVIEW_FOCUSES[i.focus].criteria.join(' and ')}.`
          }
        >
          <select
            {...a11y('rv-focus', e.focus, true)}
            value={i.focus}
            onChange={(ev) => set('focus', ev.target.value as ReviewFocus)}
            className={controlClasses(!!e.focus, 'h-10')}
          >
            {REVIEW_FOCUS_IDS.map((f) => (
              <option key={f} value={f}>
                {REVIEW_FOCUSES[f].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Review language" htmlFor="rv-language">
          <select
            {...a11y('rv-language')}
            value={i.language}
            onChange={(ev) => set('language', ev.target.value as TeachingLanguage)}
            className={controlClasses(false, 'h-10')}
          >
            {TEACHING_LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Curriculum" htmlFor="rv-curriculum">
        <select
          {...a11y('rv-curriculum')}
          value={i.curriculum}
          onChange={(ev) => set('curriculum', ev.target.value as CurriculumFramework)}
          className={controlClasses(false, 'h-10')}
        >
          {(Object.keys(CURRICULUM_FRAMEWORKS) as CurriculumFramework[]).map((c) => (
            <option key={c} value={c}>
              {c === 'auto' ? 'Not specified' : CURRICULUM_FRAMEWORKS[c].label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="School formatting requirements (optional)"
        htmlFor="rv-format"
        error={e.formatRequirements}
        hint="e.g. required sections, headings or layout. The plan is checked against these."
      >
        <textarea
          {...a11y('rv-format', e.formatRequirements, true)}
          value={i.formatRequirements}
          rows={3}
          maxLength={REVIEW_LIMITS.formatMaxChars}
          placeholder="e.g. Must include a Values Integration part and a 5-item evaluation."
          onChange={(ev) => set('formatRequirements', ev.target.value)}
          className={controlClasses(!!e.formatRequirements, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Additional review instructions (optional)"
        htmlFor="rv-instructions"
        error={e.instructions}
        hint="Numerical scores are only given if you ask for a scoring system here."
      >
        <textarea
          {...a11y('rv-instructions', e.instructions, true)}
          value={i.instructions}
          rows={3}
          maxLength={4000}
          placeholder="e.g. Pay attention to differentiation for learners with reading difficulties."
          onChange={(ev) => set('instructions', ev.target.value)}
          className={controlClasses(!!e.instructions, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Curriculum references (optional)"
        hint="Attach a curriculum guide or standard so official alignment can be checked against it."
      >
        <ReferencePicker
          value={doc.references}
          disabled={disabled}
          onChange={(references) => editor.update((d) => ({ ...d, references }))}
        />
      </Field>

      <LibraryPickerDialog
        open={libraryOpen}
        title="Choose a lesson plan from Teaching Resources"
        onClose={() => setLibraryOpen(false)}
        onPick={(r) => {
          setLibraryOpen(false)
          fromResource(r.id).catch((err: unknown) => setSourceError(ipcErrorMessage(err)))
        }}
      />
      <OpenSavedDialog
        open={plansOpen}
        kind="lesson-plan"
        noun="lesson plan"
        title="Choose a saved lesson plan to review"
        onClose={() => setPlansOpen(false)}
        onOpen={(id) => {
          setPlansOpen(false)
          teachmate.documents
            .get(id)
            .then((plan) => {
              if (!plan || plan.kind !== 'lesson-plan' || !plan.content.trim())
                throw new Error('That lesson plan has no content yet.')
              applySource(
                {
                  origin: 'document',
                  refId: plan.id,
                  title: plan.title,
                  text: plan.content.slice(0, REVIEW_LIMITS.sourceMaxChars),
                  charCount: plan.content.length,
                },
                {
                  subject: plan.inputs.subject,
                  gradeLevel: plan.inputs.gradeLevel,
                  planType: plan.inputs.format,
                },
              )
            })
            .catch((err: unknown) => setSourceError(ipcErrorMessage(err)))
        }}
      />
    </fieldset>
  )
}
