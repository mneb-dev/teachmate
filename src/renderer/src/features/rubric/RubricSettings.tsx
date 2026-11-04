import { ClipboardList, Unlink } from 'lucide-react'
import type { RubricInputs, TeachingDocument } from '@shared/documents'
import {
  RUBRIC_LIMITS,
  defaultHolistic,
  resizeLevels,
  type RubricLevelCount,
  type RubricType,
} from '@shared/rubric'
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
import { Button } from '@renderer/components/ui/Button'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'

type RubricDoc = Extract<TeachingDocument, { kind: 'rubric' }>
const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

export function RubricSettings({ editor }: { editor: DocumentEditor }) {
  const doc = editor.doc?.kind === 'rubric' ? (editor.doc as RubricDoc) : null
  if (!doc) return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof RubricInputs, string>>

  const update = (fn: (d: RubricDoc) => RubricDoc) =>
    editor.update((d) => (d.kind === 'rubric' ? fn(d as RubricDoc) : d))
  const set = <K extends keyof RubricInputs>(key: K, value: RubricInputs[K]) =>
    update((d) => ({ ...d, inputs: { ...d.inputs, [key]: value } }))

  const setType = (type: RubricType) =>
    update((d) => ({
      ...d,
      // A holistic rubric always needs a total score.
      inputs: {
        ...d.inputs,
        targetTotal: d.inputs.targetTotal ?? (type === 'holistic' ? 20 : null),
      },
      rubric: { ...d.rubric, type },
    }))

  const setLevelCount = (count: RubricLevelCount) =>
    update((d) => ({
      ...d,
      inputs: { ...d.inputs, levelCount: count },
      rubric: resizeLevels(d.rubric, count, d.inputs.targetTotal ?? 20),
    }))

  const setTarget = (target: number | null) =>
    update((d) => ({
      ...d,
      inputs: { ...d.inputs, targetTotal: target },
      // Holistic ranges follow the total score (descriptions are kept).
      rubric:
        d.rubric.type === 'holistic' && target !== null && target > 0
          ? {
              ...d.rubric,
              holistic: defaultHolistic(d.inputs.levelCount, target).map((h, k) => ({
                ...h,
                label: d.rubric.holistic[k]?.label ?? h.label,
                description: d.rubric.holistic[k]?.description ?? '',
              })),
            }
          : d.rubric,
    }))

  return (
    <div className="space-y-5">
      {i.task && (
        <div
          className="rounded-xl border border-primary/40 bg-primary-soft/50 p-3 text-sm"
          data-role="task-banner"
        >
          <div className="flex items-start gap-2">
            <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">For performance task: {i.task.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The task text is sent with the prompt so the criteria match it.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => set('task', null)}>
              <Unlink className="size-3.5" aria-hidden />
              Detach
            </Button>
          </div>
        </div>
      )}

      <Field label="Rubric type">
        <SegmentedControl<RubricType>
          label="Rubric type"
          value={doc.rubric.type}
          onChange={setType}
          options={[
            { value: 'analytic', label: 'Analytic' },
            { value: 'holistic', label: 'Holistic' },
          ]}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {doc.rubric.type === 'analytic'
            ? 'Scores each criterion separately; the total is the sum of the criteria.'
            : 'One overall judgment; each level covers a range of points.'}
        </p>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Performance levels">
          <SegmentedControl<'4' | '5'>
            label="Performance levels"
            value={String(i.levelCount) as '4' | '5'}
            onChange={(v) => setLevelCount(Number(v) as RubricLevelCount)}
            options={[
              { value: '4', label: '4 levels' },
              { value: '5', label: '5 levels' },
            ]}
          />
        </Field>
        <Field
          label={doc.rubric.type === 'holistic' ? 'Total score' : 'Target total score'}
          htmlFor="rb-target"
          required={doc.rubric.type === 'holistic'}
          error={e.targetTotal}
          hint={doc.rubric.type === 'analytic' ? 'Optional. Leave blank for any total.' : undefined}
        >
          <input
            {...a11y('rb-target', e.targetTotal, doc.rubric.type === 'analytic')}
            type="number"
            inputMode="numeric"
            min={1}
            max={RUBRIC_LIMITS.maxTotal}
            value={i.targetTotal ?? ''}
            placeholder="None"
            onChange={(ev) =>
              setTarget(ev.target.value.trim() === '' ? null : toInt(ev.target.value))
            }
            className={controlClasses(!!e.targetTotal, 'h-10')}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Subject"
          htmlFor="rb-subject"
          required
          error={e.subject}
          className="sm:col-span-2"
        >
          <input
            {...a11y('rb-subject', e.subject)}
            list="rb-subjects"
            value={i.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
          <datalist id="rb-subjects">
            {SUBJECT_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Grade level" htmlFor="rb-grade" required error={e.gradeLevel}>
          <select
            {...a11y('rb-grade', e.gradeLevel)}
            value={i.gradeLevel}
            onChange={(ev) => set('gradeLevel', ev.target.value)}
            className={controlClasses(!!e.gradeLevel, 'h-10')}
          >
            {GRADE_LEVELS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
        {doc.rubric.type === 'analytic' && (
          <Field label="Criteria for the AI to write" htmlFor="rb-criteria" error={e.criteriaCount}>
            <input
              {...a11y('rb-criteria', e.criteriaCount)}
              type="number"
              inputMode="numeric"
              min={1}
              max={RUBRIC_LIMITS.maxCriteria}
              value={i.criteriaCount || ''}
              onChange={(ev) => set('criteriaCount', toInt(ev.target.value))}
              className={controlClasses(!!e.criteriaCount, 'h-10')}
            />
          </Field>
        )}
      </div>

      <Field label="Task or product being assessed" htmlFor="rb-task" required error={e.taskTitle}>
        <input
          {...a11y('rb-task', e.taskTitle)}
          value={i.taskTitle}
          maxLength={500}
          placeholder="e.g. Recycling campaign poster"
          onChange={(ev) => set('taskTitle', ev.target.value)}
          className={controlClasses(!!e.taskTitle, 'h-10')}
        />
      </Field>

      <Field label="Learning competency (recommended)" htmlFor="rb-competency" error={e.competency}>
        <textarea
          {...a11y('rb-competency', e.competency)}
          value={i.competency}
          maxLength={2000}
          rows={2}
          onChange={(ev) => set('competency', ev.target.value)}
          className={controlClasses(!!e.competency, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Competency code (optional)"
        htmlFor="rb-code"
        error={e.competencyCode}
        hint="Only if your curriculum guide lists one. Codes are never generated."
      >
        <input
          {...a11y('rb-code', e.competencyCode, true)}
          value={i.competencyCode}
          maxLength={60}
          onChange={(ev) => set('competencyCode', ev.target.value)}
          className={controlClasses(!!e.competencyCode, 'h-10 font-mono')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Curriculum" htmlFor="rb-curriculum">
          <select
            {...a11y('rb-curriculum')}
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
        <Field label="Language" htmlFor="rb-language">
          <select
            {...a11y('rb-language')}
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
        htmlFor="rb-instructions"
        error={e.instructions}
      >
        <textarea
          {...a11y('rb-instructions', e.instructions)}
          value={i.instructions}
          maxLength={4000}
          rows={3}
          placeholder="e.g. Include a criterion on teamwork."
          onChange={(ev) => set('instructions', ev.target.value)}
          className={controlClasses(!!e.instructions, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field label="Reference documents (optional)">
        <ReferencePicker
          value={doc.references}
          onChange={(references) => editor.update((d) => ({ ...d, references }))}
        />
      </Field>
    </div>
  )
}
