import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
  RUBRIC_LIMITS,
  cellPoints,
  criterionMaxPoints,
  newCriterion,
  type HolisticLevel,
  type RubricCriterion,
  type RubricData,
  type RubricLevel,
} from '@shared/rubric'
import { controlClasses } from '@renderer/components/form/styles'
import { Button } from '@renderer/components/ui/Button'
import { IconButton } from '@renderer/components/ui/IconButton'

const toInt = (value: string) => (value.trim() === '' ? 0 : Math.trunc(Number(value)))

interface RubricEditorProps {
  rubric: RubricData
  onChange: (fn: (r: RubricData) => RubricData) => void
}

/** Editable rubric: analytic grid (criteria × levels) or holistic level list. */
export function RubricEditor({ rubric, onChange }: RubricEditorProps) {
  return rubric.type === 'analytic' ? (
    <AnalyticEditor rubric={rubric} onChange={onChange} />
  ) : (
    <HolisticEditor rubric={rubric} onChange={onChange} />
  )
}

function AnalyticEditor({ rubric, onChange }: RubricEditorProps) {
  const max = criterionMaxPoints(rubric)
  const setLevel = (i: number, patch: Partial<RubricLevel>) =>
    onChange((r) => ({ ...r, levels: r.levels.map((l, k) => (k === i ? { ...l, ...patch } : l)) }))
  const setCriterion = (id: string, patch: Partial<RubricCriterion>) =>
    onChange((r) => ({
      ...r,
      criteria: r.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  const setDescriptor = (id: string, j: number, text: string) =>
    onChange((r) => ({
      ...r,
      criteria: r.criteria.map((c) =>
        c.id === id ? { ...c, descriptors: c.descriptors.map((d, k) => (k === j ? text : d)) } : c,
      ),
    }))
  const move = (index: number, by: -1 | 1) =>
    onChange((r) => {
      const criteria = [...r.criteria]
      const [item] = criteria.splice(index, 1)
      criteria.splice(index + by, 0, item)
      return { ...r, criteria }
    })

  return (
    <div>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[46rem] border-collapse text-sm"
          aria-label="Analytic rubric"
        >
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 align-bottom">
              <th
                scope="col"
                className="w-44 px-2 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                Criterion · weight
              </th>
              {rubric.levels.map((l, i) => (
                <th key={l.id} scope="col" className="px-1.5 py-2 text-left font-medium">
                  <input
                    value={l.label}
                    maxLength={80}
                    aria-label={`Level ${i + 1} label`}
                    title={l.label}
                    onChange={(e) => setLevel(i, { label: e.target.value })}
                    className={controlClasses(!l.label.trim(), 'h-8 text-xs font-semibold')}
                  />
                  <label className="mt-1 flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={RUBRIC_LIMITS.maxScore}
                      value={l.score}
                      aria-label={`Level ${i + 1} score`}
                      onChange={(e) => setLevel(i, { score: toInt(e.target.value) })}
                      className={controlClasses(false, 'h-7 w-14 px-2 text-right tabular-nums')}
                    />
                    pts
                  </label>
                </th>
              ))}
              <th
                scope="col"
                className="w-16 px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                Max
              </th>
            </tr>
          </thead>
          <tbody>
            {rubric.criteria.map((c, i) => (
              <tr key={c.id} className="border-b border-border align-top" data-role="rubric-row">
                <td className="px-2 py-2">
                  <textarea
                    value={c.name}
                    rows={2}
                    maxLength={200}
                    placeholder={`Criterion ${i + 1}`}
                    aria-label={`Criterion ${i + 1} name`}
                    onChange={(e) => setCriterion(c.id, { name: e.target.value })}
                    className={controlClasses(
                      false,
                      'resize-none py-1.5 text-sm leading-5 font-medium',
                    )}
                  />
                  <div className="mt-1 flex items-center gap-1">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      ×
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={RUBRIC_LIMITS.maxWeight}
                        value={c.weight || ''}
                        aria-label={`Criterion ${i + 1} weight`}
                        onChange={(e) => setCriterion(c.id, { weight: toInt(e.target.value) })}
                        className={controlClasses(
                          c.weight < 1,
                          'h-7 w-12 px-2 text-right tabular-nums',
                        )}
                      />
                    </label>
                    <span className="flex-1" />
                    <IconButton
                      label={`Move criterion ${i + 1} up`}
                      className="size-6"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="size-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Move criterion ${i + 1} down`}
                      className="size-6"
                      disabled={i === rubric.criteria.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="size-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Remove criterion ${i + 1}`}
                      className="size-6"
                      disabled={rubric.criteria.length <= 1}
                      onClick={() =>
                        onChange((r) => ({
                          ...r,
                          criteria: r.criteria.filter((x) => x.id !== c.id),
                        }))
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </IconButton>
                  </div>
                </td>
                {c.descriptors.map((d, j) => (
                  <td key={j} className="px-1.5 py-2">
                    <textarea
                      value={d}
                      rows={4}
                      maxLength={RUBRIC_LIMITS.descriptorMaxChars}
                      placeholder="Describe this level…"
                      aria-label={`${c.name || `Criterion ${i + 1}`} — ${rubric.levels[j]?.label ?? `level ${j + 1}`}`}
                      onChange={(e) => setDescriptor(c.id, j, e.target.value)}
                      className={controlClasses(false, 'resize-y px-2 py-1.5 text-xs leading-5')}
                    />
                    <span className="mt-0.5 block text-right text-[11px] font-medium text-primary tabular-nums">
                      {cellPoints(rubric, c, j)} pts
                    </span>
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-semibold tabular-nums">{max[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={rubric.criteria.length >= RUBRIC_LIMITS.maxCriteria}
        onClick={() =>
          onChange((r) => ({ ...r, criteria: [...r.criteria, newCriterion('', r.levels.length)] }))
        }
      >
        <Plus className="size-4" aria-hidden />
        Add criterion
      </Button>
    </div>
  )
}

function HolisticEditor({ rubric, onChange }: RubricEditorProps) {
  const set = (i: number, patch: Partial<HolisticLevel>) =>
    onChange((r) => ({
      ...r,
      holistic: r.holistic.map((h, k) => (k === i ? { ...h, ...patch } : h)),
    }))
  return (
    <ol className="space-y-3" aria-label="Holistic rubric levels">
      {rubric.holistic.map((h, i) => (
        <li key={h.id} className="rounded-xl border border-border p-3" data-role="holistic-level">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={h.label}
              maxLength={80}
              aria-label={`Level ${i + 1} label`}
              onChange={(e) => set(i, { label: e.target.value })}
              className={controlClasses(!h.label.trim(), 'h-8 w-56 text-sm font-semibold')}
            />
            <span className="flex-1" />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Points
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={h.minPoints}
                aria-label={`Level ${i + 1} lowest points`}
                onChange={(e) => set(i, { minPoints: toInt(e.target.value) })}
                className={controlClasses(false, 'h-8 w-16 px-2 text-right tabular-nums')}
              />
              –
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={h.maxPoints}
                aria-label={`Level ${i + 1} highest points`}
                onChange={(e) => set(i, { maxPoints: toInt(e.target.value) })}
                className={controlClasses(false, 'h-8 w-16 px-2 text-right tabular-nums')}
              />
            </label>
          </div>
          <textarea
            value={h.description}
            rows={3}
            maxLength={RUBRIC_LIMITS.descriptorMaxChars * 2}
            placeholder="Describe the overall quality of work at this level…"
            aria-label={`Level ${i + 1} description`}
            onChange={(e) => set(i, { description: e.target.value })}
            className={controlClasses(false, 'mt-2 resize-y py-2 text-sm leading-6')}
          />
        </li>
      ))}
    </ol>
  )
}
