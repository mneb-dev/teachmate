import { useState } from 'react'
import { Target } from 'lucide-react'
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_DIFFICULTIES,
  ACTIVITY_DIFFICULTY_IDS,
  ACTIVITY_LIMITS,
  LEARNING_ENVIRONMENTS,
  LEARNING_ENVIRONMENT_IDS,
  objectivesFromDocument,
  type ActivityDifficulty,
  type LearningEnvironment,
} from '@shared/activities'
import type { ActivitiesInputs } from '@shared/documents'
import {
  CURRICULUM_FRAMEWORKS,
  GRADE_LEVELS,
  SUBJECT_SUGGESTIONS,
  TEACHING_LANGUAGES,
  type CurriculumFramework,
  type TeachingLanguage,
} from '@shared/teaching'
import { ChipGroup } from '@renderer/components/form/ChipGroup'
import { Field } from '@renderer/components/form/Field'
import { ReferencePicker } from '@renderer/components/form/ReferencePicker'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { Button } from '@renderer/components/ui/Button'
import { OpenSavedDialog } from '@renderer/features/documents/OpenSavedDialog'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

export function ActivitiesForm({ editor }: { editor: DocumentEditor }) {
  const [pickObjectives, setPickObjectives] = useState(false)
  const [objectivesNote, setObjectivesNote] = useState<string | null>(null)
  const doc = editor.doc
  if (!doc || doc.kind !== 'learning-activities') return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof ActivitiesInputs, string>>
  const disabled = editor.busy === 'generating'

  const set = <K extends keyof ActivitiesInputs>(key: K, value: ActivitiesInputs[K]) =>
    editor.update((d) =>
      d.kind === 'learning-activities' ? { ...d, inputs: { ...d.inputs, [key]: value } } : d,
    )

  const applySavedObjectives = async (id: string) => {
    setPickObjectives(false)
    try {
      const source = await teachmate.documents.get(id)
      if (!source || source.kind !== 'learning-objectives') return
      const found = objectivesFromDocument(source.content)
      if (found.length === 0) {
        setObjectivesNote('No objectives were found in that document.')
        return
      }
      setObjectivesNote(`Copied ${found.length} objective${found.length === 1 ? '' : 's'}.`)
      editor.update((d) => {
        if (d.kind !== 'learning-activities') return d
        const s = source.inputs
        return {
          ...d,
          inputs: {
            ...d.inputs,
            objectives: found.join('\n').slice(0, ACTIVITY_LIMITS.objectivesMaxChars),
            // Fill empty lesson details from the objectives document.
            topic: d.inputs.topic.trim() ? d.inputs.topic : s.topic,
            competency: d.inputs.competency.trim() ? d.inputs.competency : s.competency,
            competencyCode: d.inputs.competencyCode.trim()
              ? d.inputs.competencyCode
              : s.competencyCode,
          },
        }
      })
    } catch (err) {
      setObjectivesNote(ipcErrorMessage(err))
    }
  }

  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="sr-only">Learning activity details</legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Subject"
          htmlFor="la-subject"
          required
          error={e.subject}
          className="sm:col-span-2"
        >
          <input
            {...a11y('la-subject', e.subject)}
            list="la-subjects"
            value={i.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
        </Field>
        <Field label="Grade level" htmlFor="la-grade" required error={e.gradeLevel}>
          <select
            {...a11y('la-grade', e.gradeLevel)}
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
        <Field label="Quarter" htmlFor="la-quarter" required error={e.quarter}>
          <select
            {...a11y('la-quarter', e.quarter)}
            value={i.quarter}
            onChange={(ev) => set('quarter', Number(ev.target.value))}
            className={controlClasses(!!e.quarter, 'h-10')}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Quarter {q}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Lesson topic"
          htmlFor="la-topic"
          required
          error={e.topic}
          className="sm:col-span-2"
        >
          <input
            {...a11y('la-topic', e.topic)}
            value={i.topic}
            maxLength={500}
            placeholder="e.g. Parts of a computer system"
            onChange={(ev) => set('topic', ev.target.value)}
            className={controlClasses(!!e.topic, 'h-10')}
          />
        </Field>
      </div>

      <Field
        label="Learning competency"
        htmlFor="la-competency"
        required
        error={e.competency}
        hint="Copy it from your curriculum guide; every activity develops it."
      >
        <textarea
          {...a11y('la-competency', e.competency, true)}
          value={i.competency}
          maxLength={2000}
          rows={2}
          onChange={(ev) => set('competency', ev.target.value)}
          className={controlClasses(!!e.competency, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Competency code (optional)"
        htmlFor="la-code"
        error={e.competencyCode}
        hint="Only if your curriculum guide lists one. Codes are never generated."
      >
        <input
          {...a11y('la-code', e.competencyCode, true)}
          value={i.competencyCode}
          maxLength={60}
          placeholder="Leave blank if you don’t have it"
          onChange={(ev) => set('competencyCode', ev.target.value)}
          className={controlClasses(!!e.competencyCode, 'h-10 font-mono')}
        />
      </Field>

      <Field
        label="Learning objectives"
        htmlFor="la-objectives"
        error={e.objectives}
        hint={
          objectivesNote ??
          'One per line. Activities are aligned to these; leave blank to derive them from the competency.'
        }
      >
        <textarea
          {...a11y('la-objectives', e.objectives, true)}
          value={i.objectives}
          maxLength={ACTIVITY_LIMITS.objectivesMaxChars}
          rows={4}
          placeholder={
            'e.g. Identify the input, process, output and storage devices of a computer\nClassify given devices according to their function'
          }
          onChange={(ev) => set('objectives', ev.target.value)}
          className={controlClasses(!!e.objectives, 'resize-y py-2 leading-6')}
        />
        <Button
          variant="ghost"
          size="sm"
          className="mt-1.5"
          onClick={() => {
            setObjectivesNote(null)
            setPickObjectives(true)
          }}
        >
          <Target className="size-4" aria-hidden />
          Use saved objectives
        </Button>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Duration (minutes)" htmlFor="la-duration" required error={e.durationMinutes}>
          <input
            {...a11y('la-duration', e.durationMinutes)}
            type="number"
            inputMode="numeric"
            min={ACTIVITY_LIMITS.minDuration}
            max={ACTIVITY_LIMITS.maxDuration}
            step={5}
            value={i.durationMinutes || ''}
            onChange={(ev) => set('durationMinutes', toInt(ev.target.value))}
            className={controlClasses(!!e.durationMinutes, 'h-10')}
          />
        </Field>
        <Field label="Activities" htmlFor="la-count" required error={e.activityCount}>
          <input
            {...a11y('la-count', e.activityCount)}
            type="number"
            inputMode="numeric"
            min={1}
            max={ACTIVITY_LIMITS.maxActivities}
            value={i.activityCount || ''}
            onChange={(ev) => set('activityCount', toInt(ev.target.value))}
            className={controlClasses(!!e.activityCount, 'h-10')}
          />
        </Field>
        <Field label="Class size" htmlFor="la-class" required error={e.classSize}>
          <input
            {...a11y('la-class', e.classSize)}
            type="number"
            inputMode="numeric"
            min={1}
            max={ACTIVITY_LIMITS.maxClassSize}
            value={i.classSize || ''}
            onChange={(ev) => set('classSize', toInt(ev.target.value))}
            className={controlClasses(!!e.classSize, 'h-10')}
          />
        </Field>
      </div>

      <Field
        label="Activity categories"
        required
        error={e.categories}
        hint="Choose one or more. Each is used at least once when there are enough activities."
      >
        <ChipGroup
          label="Activity categories"
          options={ACTIVITY_CATEGORIES.map((c) => ({
            value: c.id,
            label: c.label,
            description: c.guidance,
          }))}
          value={i.categories}
          onChange={(v) => set('categories', v)}
          invalid={!!e.categories}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Learning environment" htmlFor="la-environment" error={e.environment}>
          <select
            {...a11y('la-environment', e.environment)}
            value={i.environment}
            onChange={(ev) => set('environment', ev.target.value as LearningEnvironment)}
            className={controlClasses(!!e.environment, 'h-10')}
          >
            {LEARNING_ENVIRONMENT_IDS.map((env) => (
              <option key={env} value={env}>
                {LEARNING_ENVIRONMENTS[env]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Difficulty level"
          htmlFor="la-difficulty"
          error={e.difficulty}
          hint={ACTIVITY_DIFFICULTIES[i.difficulty]?.description}
        >
          <select
            {...a11y('la-difficulty', e.difficulty, true)}
            value={i.difficulty}
            onChange={(ev) => set('difficulty', ev.target.value as ActivityDifficulty)}
            className={controlClasses(!!e.difficulty, 'h-10')}
          >
            {ACTIVITY_DIFFICULTY_IDS.map((d) => (
              <option key={d} value={d}>
                {ACTIVITY_DIFFICULTIES[d].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Available resources"
        htmlFor="la-resources"
        error={e.resources}
        hint="What your class really has. Activities avoid expensive materials unless you list them."
      >
        <textarea
          {...a11y('la-resources', e.resources, true)}
          value={i.resources}
          maxLength={4000}
          rows={3}
          placeholder="e.g. Whiteboard, manila paper, markers, 1 projector, 10 computers without internet"
          onChange={(ev) => set('resources', ev.target.value)}
          className={controlClasses(!!e.resources, 'resize-y py-2 leading-6')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Curriculum" htmlFor="la-curriculum">
          <select
            {...a11y('la-curriculum')}
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
        <Field label="Language" htmlFor="la-language">
          <select
            {...a11y('la-language')}
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
        htmlFor="la-instructions"
        error={e.instructions}
      >
        <textarea
          {...a11y('la-instructions', e.instructions)}
          value={i.instructions}
          maxLength={4000}
          rows={3}
          placeholder="e.g. Include one activity for learners without gadgets."
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

      <datalist id="la-subjects">
        {SUBJECT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <OpenSavedDialog
        open={pickObjectives}
        kind="learning-objectives"
        noun="set of objectives"
        onClose={() => setPickObjectives(false)}
        onOpen={(id) => void applySavedObjectives(id)}
      />
    </fieldset>
  )
}
