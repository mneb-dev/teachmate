import { Grid3x3, Info, Unlink } from 'lucide-react'
import { assessmentColumnCounts, assessmentWarnings } from '@shared/calculation-rules'
import type { AssessmentInputs } from '@shared/documents'
import {
  CURRICULUM_FRAMEWORKS,
  DIFFICULTIES,
  GRADE_LEVELS,
  SUBJECT_SUGGESTIONS,
  TEACHING_LANGUAGES,
  type CurriculumFramework,
  type Difficulty,
  type TeachingLanguage,
} from '@shared/teaching'
import { distributionColumns } from '@shared/tos'
import { DistributionEditor } from '@renderer/components/form/DistributionEditor'
import { Field } from '@renderer/components/form/Field'
import { ReferencePicker } from '@renderer/components/form/ReferencePicker'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { Button } from '@renderer/components/ui/Button'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { QuestionTypeMixer } from './QuestionTypeMixer'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

export function AssessmentForm({ editor }: { editor: DocumentEditor }) {
  const doc = editor.doc
  if (!doc || doc.kind !== 'assessment') return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof AssessmentInputs, string>>
  const disabled = editor.busy === 'generating'
  const warnings = assessmentWarnings(i)

  const set = <K extends keyof AssessmentInputs>(key: K, value: AssessmentInputs[K]) =>
    editor.update((d) =>
      d.kind === 'assessment' ? { ...d, inputs: { ...d.inputs, [key]: value } } : d,
    )

  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="sr-only">Assessment details</legend>

      {i.tos && <TosBanner inputs={i} onDetach={() => set('tos', null)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Subject"
          htmlFor="as-subject"
          required
          error={e.subject}
          className="sm:col-span-2"
        >
          <input
            {...a11y('as-subject', e.subject)}
            list="as-subjects"
            value={i.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
        </Field>
        <Field label="Grade level" htmlFor="as-grade" required error={e.gradeLevel}>
          <select
            {...a11y('as-grade', e.gradeLevel)}
            value={i.gradeLevel}
            onChange={(ev) => set('gradeLevel', ev.target.value)}
            className={controlClasses(!!e.gradeLevel, 'h-10')}
          >
            {!GRADE_LEVELS.includes(i.gradeLevel) && (
              <option value={i.gradeLevel}>{i.gradeLevel || 'Choose…'}</option>
            )}
            {GRADE_LEVELS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Difficulty"
          htmlFor="as-difficulty"
          hint={DIFFICULTIES[i.difficulty].description}
        >
          <select
            {...a11y('as-difficulty', undefined, true)}
            value={i.difficulty}
            onChange={(ev) => set('difficulty', ev.target.value as Difficulty)}
            className={controlClasses(false, 'h-10')}
          >
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTIES[d].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Topic" htmlFor="as-topic" required error={e.topic}>
        <input
          {...a11y('as-topic', e.topic)}
          value={i.topic}
          maxLength={500}
          placeholder="e.g. Basic computer hardware components"
          onChange={(ev) => set('topic', ev.target.value)}
          className={controlClasses(!!e.topic, 'h-10')}
        />
      </Field>

      <Field
        label="Learning competency (recommended)"
        htmlFor="as-competency"
        error={e.competency}
        hint="The items will be aligned to this competency."
      >
        <textarea
          {...a11y('as-competency', e.competency, true)}
          value={i.competency}
          maxLength={2000}
          rows={2}
          onChange={(ev) => set('competency', ev.target.value)}
          className={controlClasses(!!e.competency, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Competency code (optional)"
        htmlFor="as-code"
        error={e.competencyCode}
        hint="Only if your curriculum guide lists one. Codes are never generated."
      >
        <input
          {...a11y('as-code', e.competencyCode, true)}
          value={i.competencyCode}
          maxLength={60}
          placeholder="Leave blank if you don’t have it"
          onChange={(ev) => set('competencyCode', ev.target.value)}
          className={controlClasses(!!e.competencyCode, 'h-10 font-mono')}
        />
      </Field>

      <Field
        label="Number of questions"
        htmlFor="as-items"
        required
        error={e.itemCount}
        hint={i.tos ? 'Set by the attached TOS.' : undefined}
      >
        <input
          {...a11y('as-items', e.itemCount, !!i.tos)}
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          disabled={!!i.tos}
          value={i.itemCount || ''}
          onChange={(ev) => set('itemCount', toInt(ev.target.value))}
          className={controlClasses(!!e.itemCount, 'h-10 w-32')}
        />
      </Field>

      <Field label="Question types" required error={e.questionTypes}>
        <QuestionTypeMixer
          value={i.questionTypes}
          onChange={(v) => set('questionTypes', v)}
          itemCount={i.itemCount}
          invalid={!!e.questionTypes}
        />
      </Field>

      {!i.tos && (
        <Field label="Bloom’s taxonomy distribution" required error={e.distribution}>
          <DistributionEditor
            idPrefix="as-bloom"
            value={i.distribution}
            onChange={(v) => set('distribution', v)}
            itemCount={i.itemCount}
            invalid={!!e.distribution}
          />
        </Field>
      )}

      {warnings.length > 0 && (
        <p
          className="flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs leading-5 text-muted-foreground"
          role="note"
        >
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          {warnings[0]}
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5">
        <input
          type="checkbox"
          checked={i.includeExplanations}
          onChange={(ev) => set('includeExplanations', ev.target.checked)}
          className="mt-0.5 size-4 cursor-pointer accent-primary"
        />
        <span>
          <span className="block text-sm font-medium">Include explanations</span>
          <span className="block text-xs text-muted-foreground">
            Add a short explanation for each answer in the answer key.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Curriculum" htmlFor="as-curriculum">
          <select
            {...a11y('as-curriculum')}
            value={i.curriculum}
            onChange={(ev) => set('curriculum', ev.target.value as CurriculumFramework)}
            className={controlClasses(false, 'h-10')}
          >
            {(Object.keys(CURRICULUM_FRAMEWORKS) as CurriculumFramework[]).map((c) => (
              <option key={c} value={c}>
                {CURRICULUM_FRAMEWORKS[c].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Language" htmlFor="as-language">
          <select
            {...a11y('as-language')}
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

      <Field
        label="Additional instructions (optional)"
        htmlFor="as-instructions"
        error={e.instructions}
      >
        <textarea
          {...a11y('as-instructions', e.instructions)}
          value={i.instructions}
          maxLength={4000}
          rows={3}
          placeholder="e.g. Use situations from a computer laboratory; avoid brand names."
          onChange={(ev) => set('instructions', ev.target.value)}
          className={controlClasses(!!e.instructions, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field label="Reference documents (optional)">
        <ReferencePicker
          value={doc.references}
          disabled={disabled}
          onChange={(references) => editor.update((d) => ({ ...d, references }))}
        />
      </Field>

      <datalist id="as-subjects">
        {SUBJECT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </fieldset>
  )
}

function TosBanner({ inputs, onDetach }: { inputs: AssessmentInputs; onDetach: () => void }) {
  const tos = inputs.tos!
  const columns = distributionColumns(tos.mode)
  const counts = assessmentColumnCounts(inputs)
  return (
    <div
      className="rounded-xl border border-primary/40 bg-primary-soft/50 p-3 text-sm"
      data-role="tos-banner"
    >
      <div className="flex items-start gap-2">
        <Grid3x3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Based on TOS: {tos.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tos.rows.length} competenc{tos.rows.length === 1 ? 'y' : 'ies'} ·{' '}
            {columns.map((c, j) => `${c.short} ${counts[j]}`).join(' · ')}. The number of questions
            and the Bloom’s distribution come from the TOS.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDetach}
          title="Use your own distribution instead"
        >
          <Unlink className="size-3.5" aria-hidden />
          Detach
        </Button>
      </div>
    </div>
  )
}
