import { TASK_GROUPINGS, type PerformanceTaskInputs, type TaskGrouping } from '@shared/documents'
import {
  CURRICULUM_FRAMEWORKS,
  GRADE_LEVELS,
  SUBJECT_SUGGESTIONS,
  TEACHING_LANGUAGES,
  type CurriculumFramework,
  type TeachingLanguage,
} from '@shared/teaching'
import { Field } from '@renderer/components/form/Field'
import { ReferencePicker } from '@renderer/components/form/ReferencePicker'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

export function PerformanceTaskForm({ editor }: { editor: DocumentEditor }) {
  const doc = editor.doc
  if (!doc || doc.kind !== 'performance-task') return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof PerformanceTaskInputs, string>>
  const disabled = editor.busy === 'generating'

  const set = <K extends keyof PerformanceTaskInputs>(key: K, value: PerformanceTaskInputs[K]) =>
    editor.update((d) =>
      d.kind === 'performance-task' ? { ...d, inputs: { ...d.inputs, [key]: value } } : d,
    )

  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="sr-only">Performance task details</legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Subject"
          htmlFor="pt-subject"
          required
          error={e.subject}
          className="sm:col-span-2"
        >
          <input
            {...a11y('pt-subject', e.subject)}
            list="pt-subjects"
            value={i.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
        </Field>
        <Field label="Grade level" htmlFor="pt-grade" required error={e.gradeLevel}>
          <select
            {...a11y('pt-grade', e.gradeLevel)}
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
        <Field label="Lesson topic" htmlFor="pt-topic" required error={e.topic}>
          <input
            {...a11y('pt-topic', e.topic)}
            value={i.topic}
            maxLength={500}
            placeholder="e.g. Basic spreadsheets"
            onChange={(ev) => set('topic', ev.target.value)}
            className={controlClasses(!!e.topic, 'h-10')}
          />
        </Field>
      </div>

      <Field
        label="Learning competency"
        htmlFor="pt-competency"
        required
        error={e.competency}
        hint="Copy it from your curriculum guide; the task is designed around it."
      >
        <textarea
          {...a11y('pt-competency', e.competency, true)}
          value={i.competency}
          maxLength={2000}
          rows={2}
          onChange={(ev) => set('competency', ev.target.value)}
          className={controlClasses(!!e.competency, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Competency code (optional)"
        htmlFor="pt-code"
        error={e.competencyCode}
        hint="Only if your curriculum guide lists one. Codes are never generated."
      >
        <input
          {...a11y('pt-code', e.competencyCode, true)}
          value={i.competencyCode}
          maxLength={60}
          placeholder="Leave blank if you don’t have it"
          onChange={(ev) => set('competencyCode', ev.target.value)}
          className={controlClasses(!!e.competencyCode, 'h-10 font-mono')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Number of days" htmlFor="pt-days" required error={e.days}>
          <input
            {...a11y('pt-days', e.days)}
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={i.days || ''}
            onChange={(ev) => set('days', toInt(ev.target.value))}
            className={controlClasses(!!e.days, 'h-10')}
          />
        </Field>
        <Field label="Minutes per day" htmlFor="pt-minutes" required error={e.minutesPerDay}>
          <input
            {...a11y('pt-minutes', e.minutesPerDay)}
            type="number"
            inputMode="numeric"
            min={10}
            max={300}
            step={5}
            value={i.minutesPerDay || ''}
            onChange={(ev) => set('minutesPerDay', toInt(ev.target.value))}
            className={controlClasses(!!e.minutesPerDay, 'h-10')}
          />
        </Field>
      </div>

      <Field label="Learners work as">
        <SegmentedControl<TaskGrouping>
          label="Learners work as"
          value={i.grouping}
          onChange={(v) => set('grouping', v)}
          options={(Object.keys(TASK_GROUPINGS) as TaskGrouping[]).map((g) => ({
            value: g,
            label: TASK_GROUPINGS[g],
          }))}
        />
      </Field>

      <Field
        label="Available resources"
        htmlFor="pt-resources"
        error={e.resources}
        hint="What your class really has, so the task stays practical."
      >
        <textarea
          {...a11y('pt-resources', e.resources, true)}
          value={i.resources}
          maxLength={4000}
          rows={3}
          placeholder="e.g. 10 desktop computers (no internet), one projector, bond paper, coloring materials"
          onChange={(ev) => set('resources', ev.target.value)}
          className={controlClasses(!!e.resources, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Expected student output"
        htmlFor="pt-output"
        error={e.expectedOutput}
        hint="Leave blank to let the AI propose one."
      >
        <textarea
          {...a11y('pt-output', e.expectedOutput, true)}
          value={i.expectedOutput}
          maxLength={4000}
          rows={2}
          placeholder="e.g. A one-month household budget in a spreadsheet, with a short oral report"
          onChange={(ev) => set('expectedOutput', ev.target.value)}
          className={controlClasses(!!e.expectedOutput, 'resize-y py-2 leading-6')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Curriculum" htmlFor="pt-curriculum">
          <select
            {...a11y('pt-curriculum')}
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
        <Field label="Language" htmlFor="pt-language">
          <select
            {...a11y('pt-language')}
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
        htmlFor="pt-instructions"
        error={e.instructions}
      >
        <textarea
          {...a11y('pt-instructions', e.instructions)}
          value={i.instructions}
          maxLength={4000}
          rows={3}
          placeholder="e.g. Connect it to our school’s waste segregation program."
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

      <datalist id="pt-subjects">
        {SUBJECT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </fieldset>
  )
}
