import { CircleCheck, Scale, ShieldAlert } from 'lucide-react'
import { checkRubric, rubricTotal, type RubricData } from '@shared/rubric'
import { largestRemainder } from '@shared/tos'
import { Button } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'

/** Shows how the total is calculated, any calculation errors, and a fix for the weights. */
export function ScoreSummary({
  rubric,
  levelCount,
  targetTotal,
  onChange,
}: {
  rubric: RubricData
  levelCount: number
  targetTotal: number | null
  onChange: (fn: (r: RubricData) => RubricData) => void
}) {
  const check = checkRubric(rubric, levelCount, targetTotal)
  const total = rubricTotal(rubric)
  const top = rubric.levels[0]?.score ?? 0
  const weights = rubric.criteria.map((c) => c.weight)

  // Weights can be fitted to the target when it is a multiple of the top score
  // and leaves at least 1 per criterion.
  const neededWeights =
    targetTotal !== null && top > 0 && targetTotal % top === 0 ? targetTotal / top : null
  const canFit =
    rubric.type === 'analytic' &&
    neededWeights !== null &&
    neededWeights >= rubric.criteria.length &&
    total !== targetTotal

  const fitWeights = () =>
    onChange((r) => {
      const w = largestRemainder(
        neededWeights! - r.criteria.length,
        r.criteria.map(() => 1),
      ).map((x) => x + 1)
      return { ...r, criteria: r.criteria.map((c, i) => ({ ...c, weight: w[i] })) }
    })

  return (
    <Card className="p-4" aria-label="Score calculation" role="status">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Scale className="size-4 text-primary" aria-hidden />
          Total score:{' '}
          <span className="tabular-nums" data-role="rubric-total">
            {total}
          </span>{' '}
          points
        </p>
        {targetTotal !== null && (
          <span
            className={`text-xs tabular-nums ${total === targetTotal ? 'text-success' : 'text-primary'}`}
          >
            Target {targetTotal}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums" data-role="rubric-formula">
        {rubric.type === 'analytic'
          ? `Highest level ${top} pt${top === 1 ? '' : 's'} × weights (${weights.join(' + ')} = ${weights.reduce((a, b) => a + b, 0)}) = ${total}`
          : `The highest level’s range ends at ${total}; ranges: ${rubric.holistic.map((h) => `${h.minPoints}–${h.maxPoints}`).join(', ')}`}
      </p>

      {check.errors.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-success">
          <CircleCheck className="size-4" aria-hidden />
          The points and total score are correct.
        </p>
      ) : (
        <div className="mt-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-primary">
            <ShieldAlert className="size-4" aria-hidden />
            Fix {check.errors.length} problem{check.errors.length === 1 ? '' : 's'} before saving
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-5">
            {check.errors.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
          {canFit && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={fitWeights}>
              Adjust weights to total {targetTotal}
            </Button>
          )}
        </div>
      )}
      {check.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {check.warnings.map((w, i) => (
            <li key={i}>Note: {w}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}
