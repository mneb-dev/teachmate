import type { ObjectivesInputs } from '@shared/documents'
import {
  BLOOM_LEVELS,
  CURRICULUM_FRAMEWORKS,
  GRADE_LEVELS,
  LEARNING_DOMAINS,
  SUBJECT_SUGGESTIONS,
  TEACHING_LANGUAGES,
  type BloomLevel,
  type CurriculumFramework,
  type LearningDomain,
  type TeachingLanguage,
} from '@shared/teaching'
import { ChipGroup } from '@renderer/components/form/ChipGroup'
import { Field } from '@renderer/components/form/Field'
import { ReferencePicker } from '@renderer/components/form/ReferencePicker'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

export function ObjectivesForm({ editor }: { editor: DocumentEditor }) {
  const doc = editor.doc
  if (!doc || doc.kind !== 'learning-objectives') return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof ObjectivesInputs, string>>
  const disabled = editor.busy === 'generating'

  const set = <K extends keyof ObjectivesInputs>(key: K, value: ObjectivesInputs[K]) =>
    editor.update((d) =>
      d.kind === 'learning-objectives' ? { ...d, inputs: { ...d.inputs, [key]: value } } : d,
    )

  const selectedLevels = BLOOM_LEVELS.filter((b) => i.bloomLevels.includes(b.id))
  const cognitive = i.domains.includes('cognitive')
  const total =
    (cognitive ? selectedLevels.length * i.objectivesPerLevel : 0) +
    i.domains.filter((d) => d !== 'cognitive').length

  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="sr-only">Objective details</legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Subject"
          htmlFor="ob-subject"
          required
          error={e.subject}
          className="sm:col-span-2"
        >
          <input
            {...a11y('ob-subject', e.subject)}
            list="ob-subject-suggestions"
            value={i.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
        </Field>
        <Field label="Grade level" htmlFor="ob-grade" required error={e.gradeLevel}>
          <select
            {...a11y('ob-grade', e.gradeLevel)}
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
      </div>

      <Field label="Topic" htmlFor="ob-topic" required error={e.topic}>
        <input
          {...a11y('ob-topic', e.topic)}
          value={i.topic}
          maxLength={500}
          placeholder="e.g. Basic computer hardware components"
          onChange={(ev) => set('topic', ev.target.value)}
          className={controlClasses(!!e.topic, 'h-10')}
        />
      </Field>

      <Field
        label="Learning competency (recommended)"
        htmlFor="ob-competency"
        error={e.competency}
        hint="Copy it from your curriculum guide so the objectives align with it."
      >
        <textarea
          {...a11y('ob-competency', e.competency, true)}
          value={i.competency}
          maxLength={2000}
          rows={3}
          onChange={(ev) => set('competency', ev.target.value)}
          className={controlClasses(!!e.competency, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Competency code (optional)"
        htmlFor="ob-code"
        error={e.competencyCode}
        hint="Only if your curriculum guide lists one. Codes are never generated."
      >
        <input
          {...a11y('ob-code', e.competencyCode, true)}
          value={i.competencyCode}
          maxLength={60}
          placeholder="Leave blank if you don’t have it"
          onChange={(ev) => set('competencyCode', ev.target.value)}
          className={controlClasses(!!e.competencyCode, 'h-10 font-mono')}
        />
      </Field>

      <Field
        label="Bloom’s Revised Taxonomy levels"
        required
        error={e.bloomLevels}
        hint={
          selectedLevels.length > 0
            ? `Example verbs — ${selectedLevels.map((b) => `${b.label}: ${b.verbs.slice(0, 4).join(', ')}`).join(' · ')}`
            : undefined
        }
      >
        <ChipGroup<BloomLevel>
          label="Bloom’s levels"
          value={i.bloomLevels}
          onChange={(v) => set('bloomLevels', v)}
          invalid={!!e.bloomLevels}
          options={BLOOM_LEVELS.map((b) => ({
            value: b.id,
            label: b.label,
            description: b.description,
          }))}
        />
      </Field>

      <Field
        label="Learning domains"
        required
        error={e.domains}
        hint="Psychomotor and affective objectives are only added where they fit the topic."
      >
        <ChipGroup<LearningDomain>
          label="Learning domains"
          value={i.domains}
          onChange={(v) => set('domains', v)}
          invalid={!!e.domains}
          options={LEARNING_DOMAINS.map((d) => ({
            value: d.id,
            label: d.label,
            description: d.description,
          }))}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Objectives per level"
          htmlFor="ob-per-level"
          required
          error={e.objectivesPerLevel}
          hint={
            total > 0 ? `About ${total} objective${total === 1 ? '' : 's'} in total` : undefined
          }
        >
          <select
            {...a11y('ob-per-level', e.objectivesPerLevel, true)}
            value={i.objectivesPerLevel}
            onChange={(ev) => set('objectivesPerLevel', toInt(ev.target.value))}
            className={controlClasses(!!e.objectivesPerLevel, 'h-10')}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Time allotment (minutes)"
          htmlFor="ob-minutes"
          required
          error={e.durationMinutes}
        >
          <input
            {...a11y('ob-minutes', e.durationMinutes)}
            type="number"
            inputMode="numeric"
            min={10}
            max={300}
            step={5}
            value={i.durationMinutes || ''}
            onChange={(ev) => set('durationMinutes', toInt(ev.target.value))}
            className={controlClasses(!!e.durationMinutes, 'h-10')}
          />
        </Field>
        <Field label="Curriculum" htmlFor="ob-curriculum">
          <select
            {...a11y('ob-curriculum')}
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
        <Field label="Language" htmlFor="ob-language">
          <select
            {...a11y('ob-language')}
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
        htmlFor="ob-instructions"
        error={e.instructions}
      >
        <textarea
          {...a11y('ob-instructions', e.instructions)}
          value={i.instructions}
          maxLength={4000}
          rows={3}
          placeholder="e.g. Include an objective on safe handling of computer parts."
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

      <datalist id="ob-subject-suggestions">
        {SUBJECT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </fieldset>
  )
}
