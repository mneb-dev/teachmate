import { useState } from 'react'
import { ListPlus, Plus, Trash2 } from 'lucide-react'
import { tosCompetencyErrors } from '@shared/calculation-rules'
import { GRADE_LEVELS, SUBJECT_SUGGESTIONS } from '@shared/teaching'
import { TOS_LIMITS, totalHours, type TosCompetency, type TosInputs } from '@shared/tos'
import { DistributionEditor } from '@renderer/components/form/DistributionEditor'
import { Field } from '@renderer/components/form/Field'
import { a11y, controlClasses } from '@renderer/components/form/styles'
import { Button } from '@renderer/components/ui/Button'
import { Dialog } from '@renderer/components/ui/Dialog'
import { IconButton } from '@renderer/components/ui/IconButton'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))
const toNum = (value: string) => (value.trim() === '' ? 0 : Number(value))
const newRow = (competency = '', hours = 1): TosCompetency => ({
  id: crypto.randomUUID(),
  competency,
  code: '',
  hours,
})

interface TosFormProps {
  inputs: TosInputs
  errors: Partial<Record<keyof TosInputs, string>>
  showErrors: boolean
  onChange: (fn: (inputs: TosInputs) => TosInputs) => void
}

export function TosForm({ inputs, errors: e, showErrors, onChange }: TosFormProps) {
  const [bulkOpen, setBulkOpen] = useState(false)
  const rowErrors = tosCompetencyErrors(inputs)
  const set = <K extends keyof TosInputs>(key: K, value: TosInputs[K]) =>
    onChange((i) => ({ ...i, [key]: value }))
  const setRow = (id: string, patch: Partial<TosCompetency>) =>
    onChange((i) => ({
      ...i,
      competencies: i.competencies.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  const room = TOS_LIMITS.maxCompetencies - inputs.competencies.length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Test title"
          htmlFor="tos-title"
          required
          error={e.examTitle}
          className="sm:col-span-2"
        >
          <input
            {...a11y('tos-title', e.examTitle)}
            value={inputs.examTitle}
            maxLength={500}
            placeholder="e.g. First Quarterly Examination"
            onChange={(ev) => set('examTitle', ev.target.value)}
            className={controlClasses(!!e.examTitle, 'h-10')}
          />
        </Field>
        <Field
          label="Subject"
          htmlFor="tos-subject"
          required
          error={e.subject}
          className="sm:col-span-2"
        >
          <input
            {...a11y('tos-subject', e.subject)}
            list="tos-subjects"
            value={inputs.subject}
            maxLength={500}
            onChange={(ev) => set('subject', ev.target.value)}
            className={controlClasses(!!e.subject, 'h-10')}
          />
          <datalist id="tos-subjects">
            {SUBJECT_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Grade level" htmlFor="tos-grade" required error={e.gradeLevel}>
          <select
            {...a11y('tos-grade', e.gradeLevel)}
            value={inputs.gradeLevel}
            onChange={(ev) => set('gradeLevel', ev.target.value)}
            className={controlClasses(!!e.gradeLevel, 'h-10')}
          >
            {GRADE_LEVELS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Quarter" htmlFor="tos-quarter" required error={e.quarter}>
          <select
            {...a11y('tos-quarter', e.quarter)}
            value={inputs.quarter}
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
        <Field label="Number of test items" htmlFor="tos-items" required error={e.totalItems}>
          <input
            {...a11y('tos-items', e.totalItems)}
            type="number"
            inputMode="numeric"
            min={1}
            max={TOS_LIMITS.maxItems}
            value={inputs.totalItems || ''}
            onChange={(ev) => set('totalItems', toInt(ev.target.value))}
            className={controlClasses(!!e.totalItems, 'h-10')}
          />
        </Field>
      </div>

      <Field label="Bloom’s taxonomy distribution" required error={e.distribution}>
        <DistributionEditor
          idPrefix="tos-bloom"
          value={inputs.distribution}
          onChange={(v) => set('distribution', v)}
          itemCount={inputs.totalItems}
          invalid={!!e.distribution}
        />
      </Field>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            Learning competencies<span className="ml-0.5 text-primary">*</span>
          </p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {inputs.competencies.length} · {Number(totalHours(inputs).toFixed(2))} hours total
          </span>
        </div>
        {e.competencies && (
          <p className="mb-2 text-xs text-primary" role="alert">
            {e.competencies}
          </p>
        )}
        <ol className="space-y-2" aria-label="Learning competencies">
          {inputs.competencies.map((c, idx) => {
            const re = showErrors ? rowErrors[idx] : {}
            const hoursError = rowErrors[idx].hours
            return (
              <li
                key={c.id}
                className="rounded-xl border border-border p-3"
                data-role="competency-row"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <label htmlFor={`tos-c-${c.id}`} className="sr-only">
                      Competency {idx + 1}
                    </label>
                    <textarea
                      id={`tos-c-${c.id}`}
                      value={c.competency}
                      rows={2}
                      maxLength={2000}
                      placeholder="Learning competency (copy it from your curriculum guide)"
                      aria-invalid={re.competency ? true : undefined}
                      onChange={(ev) => setRow(c.id, { competency: ev.target.value })}
                      className={controlClasses(!!re.competency, 'resize-y py-2 text-sm leading-5')}
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
                        Code
                        <input
                          value={c.code}
                          maxLength={60}
                          placeholder="optional"
                          aria-label={`Competency ${idx + 1} code`}
                          aria-invalid={re.code ? true : undefined}
                          onChange={(ev) => setRow(c.id, { code: ev.target.value })}
                          className={controlClasses(
                            !!re.code,
                            'h-8 min-w-0 flex-1 font-mono text-xs',
                          )}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Hours
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0.25}
                          step={0.5}
                          max={TOS_LIMITS.maxHours}
                          value={Number.isFinite(c.hours) && c.hours !== 0 ? c.hours : ''}
                          aria-label={`Competency ${idx + 1} teaching hours`}
                          aria-invalid={hoursError ? true : undefined}
                          onChange={(ev) => setRow(c.id, { hours: toNum(ev.target.value) })}
                          className={controlClasses(
                            !!hoursError,
                            'h-8 w-20 text-right tabular-nums',
                          )}
                        />
                      </label>
                    </div>
                    {(re.competency || re.code || hoursError) && (
                      <p className="text-xs text-primary">
                        {re.competency ?? re.code ?? hoursError}
                      </p>
                    )}
                  </div>
                  <IconButton
                    label={`Remove competency ${idx + 1}`}
                    disabled={inputs.competencies.length <= 1}
                    onClick={() =>
                      onChange((i) => ({
                        ...i,
                        competencies: i.competencies.filter((x) => x.id !== c.id),
                      }))
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={room <= 0}
            onClick={() => onChange((i) => ({ ...i, competencies: [...i.competencies, newRow()] }))}
          >
            <Plus className="size-4" aria-hidden />
            Add competency
          </Button>
          <Button variant="ghost" size="sm" disabled={room <= 0} onClick={() => setBulkOpen(true)}>
            <ListPlus className="size-4" aria-hidden />
            Add several…
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Items are allocated in proportion to teaching hours. Codes are only what you type —
          TeachMate never makes them up.
        </p>
      </div>

      <BulkAddDialog
        open={bulkOpen}
        max={room}
        onClose={() => setBulkOpen(false)}
        onAdd={(rows) => {
          onChange((i) => {
            // Replace a single empty starter row instead of keeping it.
            const keep = i.competencies.filter(
              (c) => c.competency.trim() || i.competencies.length > 1,
            )
            return { ...i, competencies: [...keep, ...rows].slice(0, TOS_LIMITS.maxCompetencies) }
          })
          setBulkOpen(false)
        }}
      />
    </div>
  )
}

/** Paste one competency per line, optionally ending with "; hours" (e.g. "Identify parts; 3"). */
function BulkAddDialog({
  open,
  max,
  onClose,
  onAdd,
}: {
  open: boolean
  max: number
  onClose: () => void
  onAdd: (rows: TosCompetency[]) => void
}) {
  const [text, setText] = useState('')
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)[;\t]\s*(\d+(?:\.\d+)?)\s*h?(?:ours?)?\s*$/i)
      return m ? newRow(m[1].trim(), Number(m[2])) : newRow(line, 1)
    })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add several competencies"
      description="One competency per line. To set hours, end the line with a semicolon and the number of hours, e.g. “Identify computer parts; 3”. Otherwise each gets 1 hour."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={rows.length === 0 || rows.length > max}
            onClick={() => {
              onAdd(rows)
              setText('')
            }}
          >
            Add {rows.length || ''} competenc{rows.length === 1 ? 'y' : 'ies'}
          </Button>
        </>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        rows={8}
        aria-label="Competencies, one per line"
        className={controlClasses(false, 'resize-y py-2 font-mono text-xs leading-5')}
      />
      {rows.length > max && (
        <p className="mt-2 text-xs text-primary">You can add at most {max} more.</p>
      )}
    </Dialog>
  )
}
