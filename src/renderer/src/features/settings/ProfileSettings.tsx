import { useEffect, useState } from 'react'
import { CircleCheck, UserRound } from 'lucide-react'
import {
  PROFILE_NAME_MAX,
  TEACHER_TITLES,
  TEACHER_TITLE_IDS,
  addressTeacher,
  type TeacherProfile,
  type TeacherTitle,
} from '@shared/teaching'
import { Field } from '@renderer/components/form/Field'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { IconTile } from '@renderer/components/ui/IconTile'
import { SegmentedControl } from '@renderer/components/ui/SegmentedControl'
import { greetingFor } from '@renderer/lib/format'
import { ipcErrorMessage, teachmate } from '@renderer/lib/ipc'

/** The teacher's name and form of address (Ma’am / Sir), used in the dashboard greeting. */
export function ProfileSettings() {
  const [saved, setSaved] = useState<TeacherProfile | null>(null)
  const [draft, setDraft] = useState<TeacherProfile | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    teachmate.settings
      .get()
      .then((s) => {
        setSaved(s.profile)
        setDraft(s.profile)
      })
      .catch((err: unknown) => setStatus({ ok: false, text: ipcErrorMessage(err) }))
  }, [])

  const header = (
    <CardHeader
      title="Your profile"
      description="How TeachMate greets you on the dashboard."
      icon={<IconTile icon={UserRound} size="sm" tone="muted" />}
    />
  )

  if (!draft) {
    return (
      <Card>
        {header}
        <CardBody>
          <p className="text-sm text-muted-foreground">{status?.text ?? 'Loading…'}</p>
        </CardBody>
      </Card>
    )
  }

  const set = <K extends keyof TeacherProfile>(key: K, value: TeacherProfile[K]) => {
    setDraft({ ...draft, [key]: value })
    setStatus(null)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const save = () => {
    teachmate.settings
      .updateProfile(draft)
      .then((s) => {
        setSaved(s.profile)
        setDraft(s.profile)
        setStatus({ ok: true, text: 'Saved.' })
      })
      .catch((err: unknown) => setStatus({ ok: false, text: ipcErrorMessage(err) }))
  }

  return (
    <Card aria-label="Your profile">
      {header}
      <CardBody className="space-y-5">
        <Field
          label="Name"
          htmlFor="pf-name"
          hint="How you’d like to be greeted, e.g. Liza or Dela Cruz."
        >
          <input
            {...a11y('pf-name', undefined, true)}
            value={draft.name}
            maxLength={PROFILE_NAME_MAX}
            autoComplete="given-name"
            onChange={(e) => set('name', e.target.value)}
            className={controlClasses(false, 'h-10')}
          />
        </Field>

        <Field label="Address me as" hint="Used in the dashboard greeting.">
          <SegmentedControl<TeacherTitle>
            label="Address me as"
            value={draft.title}
            onChange={(v) => set('title', v)}
            options={TEACHER_TITLE_IDS.map((t) => ({ value: t, label: TEACHER_TITLES[t].label }))}
          />
        </Field>

        <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm" data-role="greeting-preview">
          <span className="text-muted-foreground">Dashboard greeting: </span>
          <span className="font-medium">
            {greetingFor()}, {addressTeacher(draft)}
          </span>
        </p>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {status && (
            <span
              role="status"
              className={
                status.ok ? 'flex items-center gap-1 text-xs text-success' : 'text-xs text-primary'
              }
            >
              {status.ok && <CircleCheck className="size-3.5" aria-hidden />}
              {status.text}
            </span>
          )}
          <Button size="sm" onClick={save} disabled={!dirty}>
            Save profile
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
