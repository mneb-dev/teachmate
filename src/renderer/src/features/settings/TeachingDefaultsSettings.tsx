import { useEffect, useState } from 'react'
import { CircleCheck, GraduationCap } from 'lucide-react'
import {
  CURRICULUM_FRAMEWORKS,
  DEFAULT_TEACHING_DEFAULTS,
  GRADE_LEVELS,
  SUBJECT_SUGGESTIONS,
  TEACHING_LANGUAGES,
  type CurriculumFramework,
  type TeachingDefaults,
  type TeachingLanguage,
} from '@shared/teaching'
import { Field } from '@renderer/components/form/Field'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

/** Defaults used to pre-fill new lesson plans and objective sets. */
export function TeachingDefaultsSettings() {
  const [saved, setSaved] = useState<TeachingDefaults | null>(null)
  const [draft, setDraft] = useState<TeachingDefaults | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    teachmate.settings
      .get()
      .then((s) => {
        setSaved(s.teaching)
        setDraft(s.teaching)
      })
      .catch((err: unknown) => setStatus({ ok: false, text: ipcErrorMessage(err) }))
  }, [])

  if (!draft) {
    return (
      <Card>
        <CardHeader
          title="Teaching defaults"
          icon={<IconTile icon={GraduationCap} size="sm" tone="muted" />}
        />
        <CardBody>
          <p className="text-sm text-muted-foreground">{status?.text ?? 'Loading…'}</p>
        </CardBody>
      </Card>
    )
  }

  const set = <K extends keyof TeachingDefaults>(key: K, value: TeachingDefaults[K]) => {
    setDraft({ ...draft, [key]: value })
    setStatus(null)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const durationError =
    Number.isInteger(draft.durationMinutes) &&
    draft.durationMinutes >= 10 &&
    draft.durationMinutes <= 300
      ? undefined
      : 'Use a whole number from 10 to 300.'
  const subjectError = draft.subject.trim() ? undefined : 'Subject is required.'
  const countryError = draft.country.trim() ? undefined : 'Country is required.'

  const save = () => {
    teachmate.settings
      .updateTeaching(draft)
      .then((s) => {
        setSaved(s.teaching)
        setDraft(s.teaching)
        setStatus({ ok: true, text: 'Saved. New documents will use these defaults.' })
      })
      .catch((err: unknown) => setStatus({ ok: false, text: ipcErrorMessage(err) }))
  }

  return (
    <Card>
      <CardHeader
        title="Teaching defaults"
        description="Pre-fill new lesson plans and objectives."
        icon={<IconTile icon={GraduationCap} size="sm" tone="muted" />}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="td-country" error={countryError}>
            <input
              {...a11y('td-country', countryError)}
              value={draft.country}
              maxLength={80}
              onChange={(e) => set('country', e.target.value)}
              className={controlClasses(!!countryError, 'h-10')}
            />
          </Field>
          <Field
            label="Curriculum"
            htmlFor="td-curriculum"
            hint={CURRICULUM_FRAMEWORKS[draft.curriculum].description}
          >
            <select
              {...a11y('td-curriculum', undefined, true)}
              value={draft.curriculum}
              onChange={(e) => set('curriculum', e.target.value as CurriculumFramework)}
              className={controlClasses(false, 'h-10')}
            >
              {(Object.keys(CURRICULUM_FRAMEWORKS) as CurriculumFramework[]).map((c) => (
                <option key={c} value={c}>
                  {CURRICULUM_FRAMEWORKS[c].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grade level" htmlFor="td-grade">
            <select
              {...a11y('td-grade')}
              value={draft.gradeLevel}
              onChange={(e) => set('gradeLevel', e.target.value)}
              className={controlClasses(false, 'h-10')}
            >
              {GRADE_LEVELS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject" htmlFor="td-subject" error={subjectError}>
            <input
              {...a11y('td-subject', subjectError)}
              list="td-subjects"
              value={draft.subject}
              maxLength={200}
              onChange={(e) => set('subject', e.target.value)}
              className={controlClasses(!!subjectError, 'h-10')}
            />
            <datalist id="td-subjects">
              {SUBJECT_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Duration (minutes)" htmlFor="td-duration" error={durationError}>
            <input
              {...a11y('td-duration', durationError)}
              type="number"
              min={10}
              max={300}
              step={5}
              value={Number.isFinite(draft.durationMinutes) ? draft.durationMinutes : ''}
              onChange={(e) => set('durationMinutes', Math.trunc(Number(e.target.value)))}
              className={controlClasses(!!durationError, 'h-10')}
            />
          </Field>
          <Field label="Language" htmlFor="td-language">
            <select
              {...a11y('td-language')}
              value={draft.language}
              onChange={(e) => set('language', e.target.value as TeachingLanguage)}
              className={controlClasses(false, 'h-10')}
            >
              {TEACHING_LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={save}
            disabled={!dirty || !!durationError || !!subjectError || !!countryError}
          >
            Save defaults
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft({ ...DEFAULT_TEACHING_DEFAULTS })
              setStatus(null)
            }}
          >
            Reset to Philippines / Grade 8 / ICT
          </Button>
          {status && (
            <span
              role="status"
              className={`flex items-center gap-1 text-xs ${status.ok ? 'text-success' : 'text-primary'}`}
            >
              {status.ok && <CircleCheck className="size-3.5" aria-hidden />}
              {status.text}
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
