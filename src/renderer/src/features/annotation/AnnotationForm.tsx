import { useState } from 'react'
import { BookOpen, FileText, Library, LoaderCircle, Upload } from 'lucide-react'
import {
  ANNOTATION_LENGTHS,
  ANNOTATION_LIMITS,
  ANNOTATION_PERSPECTIVES,
  wordCount,
  type AnnotationLength,
  type AnnotationPerspective,
  type AnnotationSource,
} from '@shared/annotation'
import type { AnnotationInputs } from '@shared/documents'
import { TEACHING_LANGUAGES, type TeachingLanguage } from '@shared/teaching'
import { Field } from '@renderer/components/form/Field'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { LibraryPickerDialog } from '@renderer/components/library/LibraryPickerDialog'
import { Button } from '@renderer/components/ui/Button'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import { OpenSavedDialog } from '@renderer/features/documents/OpenSavedDialog'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

export function AnnotationForm({ editor }: { editor: DocumentEditor }) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [showText, setShowText] = useState(false)

  const doc = editor.doc
  if (!doc || doc.kind !== 'annotation') return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof AnnotationInputs, string>>
  const disabled = editor.busy === 'generating'

  const set = <K extends keyof AnnotationInputs>(key: K, value: AnnotationInputs[K]) =>
    editor.update((d) =>
      d.kind === 'annotation' ? { ...d, inputs: { ...d.inputs, [key]: value } } : d,
    )

  const applySource = (source: AnnotationSource, subject?: string, gradeLevel?: string) => {
    setSourceError(null)
    editor.update((d) =>
      d.kind === 'annotation'
        ? {
            ...d,
            inputs: {
              ...d.inputs,
              source,
              subject: subject?.trim() || d.inputs.subject,
              gradeLevel: gradeLevel?.trim() || d.inputs.gradeLevel,
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
        text: r.text.slice(0, ANNOTATION_LIMITS.sourceMaxChars),
        charCount: r.charCount,
      },
      r.subject,
      r.gradeLevel,
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

  const { min, max } = ANNOTATION_LENGTHS[i.length]

  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="sr-only">Annotation details</legend>

      <Field label="DLL to annotate" required error={e.source ?? sourceError ?? undefined}>
        {i.source ? (
          <div className="rounded-xl border border-border p-3" data-role="annotation-source">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.source.title}</p>
                <p className="text-xs text-muted-foreground">
                  {i.source.origin === 'resource' ? 'From Teaching Resources' : 'Saved lesson plan'}{' '}
                  · {wordCount(i.source.text).toLocaleString()} words — the whole lesson is sent
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
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Choose the Daily Lesson Log you want to annotate.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void upload()} disabled={uploading}>
            {uploading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            Upload a DLL
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setLibraryOpen(true)}>
            <Library className="size-4" aria-hidden />
            From library
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPlansOpen(true)}>
            <BookOpen className="size-4" aria-hidden />
            Saved lesson plan
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Uploaded files are kept in Teaching Resources; DOCX, PDF, TXT or MD.
        </p>
      </Field>

      <Field
        label="Focus (optional)"
        htmlFor="an-focus"
        error={e.focus}
        hint="e.g. a PPST indicator or what the observer should notice. Paste indicator text exactly; numbers are never invented."
      >
        <textarea
          {...a11y('an-focus', e.focus, true)}
          value={i.focus}
          rows={2}
          maxLength={ANNOTATION_LIMITS.focusMaxChars}
          onChange={(ev) => set('focus', ev.target.value)}
          className={controlClasses(!!e.focus, 'resize-y py-2 leading-6')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Paragraphs"
          htmlFor="an-paragraphs"
          required
          error={e.paragraphs}
          hint={i.paragraphs === 1 ? 'Exactly one paragraph.' : undefined}
        >
          <select
            {...a11y('an-paragraphs', e.paragraphs, i.paragraphs === 1)}
            value={i.paragraphs}
            onChange={(ev) => set('paragraphs', toInt(ev.target.value))}
            className={controlClasses(!!e.paragraphs, 'h-10')}
          >
            {Array.from({ length: ANNOTATION_LIMITS.maxParagraphs }, (_, k) => k + 1).map((n) => (
              <option key={n} value={n}>
                {n} paragraph{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Language" htmlFor="an-language">
          <select
            {...a11y('an-language')}
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

      <Field label="Paragraph length" hint={`${min}–${max} words per paragraph`}>
        <SegmentedControl<AnnotationLength>
          label="Paragraph length"
          value={i.length}
          onChange={(v) => set('length', v)}
          options={(Object.keys(ANNOTATION_LENGTHS) as AnnotationLength[]).map((l) => ({
            value: l,
            label: ANNOTATION_LENGTHS[l].label,
          }))}
        />
      </Field>

      <Field label="Perspective" hint={ANNOTATION_PERSPECTIVES[i.perspective].example}>
        <SegmentedControl<AnnotationPerspective>
          label="Perspective"
          value={i.perspective}
          onChange={(v) => set('perspective', v)}
          options={(Object.keys(ANNOTATION_PERSPECTIVES) as AnnotationPerspective[]).map((p) => ({
            value: p,
            label: ANNOTATION_PERSPECTIVES[p].label,
          }))}
        />
      </Field>

      <Field
        label="Additional instructions (optional)"
        htmlFor="an-instructions"
        error={e.instructions}
      >
        <textarea
          {...a11y('an-instructions', e.instructions)}
          value={i.instructions}
          rows={3}
          maxLength={4000}
          placeholder="e.g. Emphasize how the activities addressed learners with different needs."
          onChange={(ev) => set('instructions', ev.target.value)}
          className={controlClasses(!!e.instructions, 'resize-y py-2 leading-6')}
        />
      </Field>

      <LibraryPickerDialog
        open={libraryOpen}
        title="Choose a DLL from Teaching Resources"
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
        onClose={() => setPlansOpen(false)}
        onOpen={(id) => {
          setPlansOpen(false)
          teachmate.documents
            .get(id)
            .then((plan) => {
              if (!plan || !plan.content.trim())
                throw new Error('That lesson plan has no content yet.')
              applySource(
                {
                  origin: 'document',
                  refId: plan.id,
                  title: plan.title,
                  text: plan.content.slice(0, ANNOTATION_LIMITS.sourceMaxChars),
                  charCount: plan.content.length,
                },
                plan.inputs.subject,
                plan.inputs.gradeLevel,
              )
            })
            .catch((err: unknown) => setSourceError(ipcErrorMessage(err)))
        }}
      />
    </fieldset>
  )
}
