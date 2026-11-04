import type { LessonPlanInputs } from '@shared/documents'
import {
  CURRICULUM_FRAMEWORKS,
  GRADE_LEVELS,
  LESSON_PLAN_FORMATS,
  LESSON_PLAN_FORMAT_IDS,
  SUBJECT_SUGGESTIONS,
  TEACHING_LANGUAGES,
  type CurriculumFramework,
  type LessonPlanFormat,
  type TeachingLanguage,
} from '@shared/teaching'
import { Field } from '@renderer/components/form/Field'
import { ReferencePicker } from '@renderer/components/form/ReferencePicker'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { cn } from '@renderer/lib/cn'
import type { DocumentEditor } from '@renderer/features/documents/useDocumentEditor'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

export function LessonPlanForm({ editor }: { editor: DocumentEditor }) {
  const doc = editor.doc
  if (!doc || doc.kind !== 'lesson-plan') return null
  const i = doc.inputs
  const e = editor.errors as Partial<Record<keyof LessonPlanInputs, string>>
  const disabled = editor.busy === 'generating'

  const set = <K extends keyof LessonPlanInputs>(key: K, value: LessonPlanInputs[K]) =>
    editor.update((d) =>
      d.kind === 'lesson-plan' ? { ...d, inputs: { ...d.inputs, [key]: value } } : d,
    )

  const setFormat = (format: LessonPlanFormat) => {
    const { minSessions, maxSessions } = LESSON_PLAN_FORMATS[format]
    editor.update((d) =>
      d.kind === 'lesson-plan'
        ? {
            ...d,
            inputs: {
              ...d.inputs,
              format,
              sessions: Math.min(
                maxSessions,
                Math.max(minSessions, d.inputs.sessions || minSessions),
              ),
            },
          }
        : d,
    )
  }

  const format = LESSON_PLAN_FORMATS[i.format]

  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="sr-only">Lesson details</legend>

      <Field label="Lesson plan format" required error={e.format}>
        <div role="radiogroup" aria-label="Lesson plan format" className="grid gap-2">
          {LESSON_PLAN_FORMAT_IDS.map((id) => {
            const f = LESSON_PLAN_FORMATS[id]
            const selected = i.format === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFormat(id)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-primary/50 bg-primary-soft'
                    : 'border-border hover:bg-surface-muted',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-primary' : 'border-muted-foreground/50',
                  )}
                  aria-hidden
                >
                  {selected && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span>
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      selected && 'text-primary-soft-foreground',
                    )}
                  >
                    {f.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{f.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Subject"
          htmlFor="lp-subject"
          required
          error={e.subject}
          className="sm:col-span-2"
        >
          <input
            {...a11y('lp-subject', e.subject)}
            list="subject-suggestions"
            value={i.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
        </Field>
        <Field label="Grade level" htmlFor="lp-grade" required error={e.gradeLevel}>
          <select
            {...a11y('lp-grade', e.gradeLevel)}
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
        <Field label="Quarter" htmlFor="lp-quarter" required error={e.quarter}>
          <select
            {...a11y('lp-quarter', e.quarter)}
            value={i.quarter}
            onChange={(ev) => set('quarter', toInt(ev.target.value))}
            className={controlClasses(!!e.quarter, 'h-10')}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Quarter {q}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Week" htmlFor="lp-week" required error={e.week}>
          <select
            {...a11y('lp-week', e.week)}
            value={i.week}
            onChange={(ev) => set('week', toInt(ev.target.value))}
            className={controlClasses(!!e.week, 'h-10')}
          >
            {Array.from({ length: 12 }, (_, k) => k + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Topic" htmlFor="lp-topic" required error={e.topic}>
        <input
          {...a11y('lp-topic', e.topic)}
          value={i.topic}
          maxLength={500}
          placeholder="e.g. Using formulas and functions in a spreadsheet"
          onChange={(ev) => set('topic', ev.target.value)}
          className={controlClasses(!!e.topic, 'h-10')}
        />
      </Field>

      <Field
        label="Learning competency"
        htmlFor="lp-competency"
        required
        error={e.competency}
        hint="Copy it from your curriculum guide (MELC, MATATAG or ILAW) exactly as written."
      >
        <textarea
          {...a11y('lp-competency', e.competency, true)}
          value={i.competency}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Use basic spreadsheet formulas and functions to solve problems"
          onChange={(ev) => set('competency', ev.target.value)}
          className={controlClasses(!!e.competency, 'resize-y py-2 leading-6')}
        />
      </Field>

      <Field
        label="Competency code (optional)"
        htmlFor="lp-code"
        error={e.competencyCode}
        hint="Only if your curriculum guide lists one. TeachMate never makes up codes — if left blank, the plan says “Code: not provided”."
      >
        <input
          {...a11y('lp-code', e.competencyCode, true)}
          value={i.competencyCode}
          maxLength={60}
          placeholder="Leave blank if you don’t have it"
          onChange={(ev) => set('competencyCode', ev.target.value)}
          className={controlClasses(!!e.competencyCode, 'h-10 font-mono')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Time allotment (minutes per session)"
          htmlFor="lp-minutes"
          required
          error={e.durationMinutes}
        >
          <input
            {...a11y('lp-minutes', e.durationMinutes)}
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
        <Field
          label="Number of sessions"
          htmlFor="lp-sessions"
          required
          error={e.sessions}
          hint={`${format.short}: ${format.minSessions}–${format.maxSessions}`}
        >
          <input
            {...a11y('lp-sessions', e.sessions, true)}
            type="number"
            inputMode="numeric"
            min={format.minSessions}
            max={format.maxSessions}
            value={i.sessions || ''}
            onChange={(ev) => set('sessions', toInt(ev.target.value))}
            className={controlClasses(!!e.sessions, 'h-10')}
          />
        </Field>
        <Field
          label="Curriculum"
          htmlFor="lp-curriculum"
          hint={CURRICULUM_FRAMEWORKS[i.curriculum].description}
        >
          <select
            {...a11y('lp-curriculum', undefined, true)}
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
        <Field label="Language" htmlFor="lp-language">
          <select
            {...a11y('lp-language')}
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
        htmlFor="lp-instructions"
        error={e.instructions}
        hint="e.g. class size, available equipment, learners’ needs, integration with other subjects."
      >
        <textarea
          {...a11y('lp-instructions', e.instructions, true)}
          value={i.instructions}
          maxLength={4000}
          rows={3}
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

      <datalist id="subject-suggestions">
        {SUBJECT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </fieldset>
  )
}
