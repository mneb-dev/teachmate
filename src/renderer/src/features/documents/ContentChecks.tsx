import { useMemo } from 'react'
import { ShieldAlert } from 'lucide-react'
import { checkActivities } from '@shared/activities'
import { checkAnnotation } from '@shared/annotation'
import { checkAnswerKey, checkPerformanceTaskSections } from '@shared/calculation-rules'
import { findNonMeasurableVerbs, findUnverifiedCodes } from '@shared/document-rules'
import { checkReview } from '@shared/review'
import { trustedSourceText } from '@shared/document-text'
import type { TeachingDocument } from '@shared/documents'

/**
 * Local checks on the document text: unverified curriculum codes, vague
 * objective verbs and (for assessments) a complete answer key.
 */
export function ContentChecks({ doc }: { doc: TeachingDocument }) {
  const warnings = useMemo(
    () => [
      ...(doc.kind === 'assessment' ? checkAnswerKey(doc.content, doc.inputs.itemCount) : []),
      ...(doc.kind === 'performance-task' ? checkPerformanceTaskSections(doc.content) : []),
      ...(doc.kind === 'learning-activities'
        ? checkActivities(doc.content, {
            activityCount: doc.inputs.activityCount,
            durationMinutes: doc.inputs.durationMinutes,
          })
        : []),
      ...(doc.kind === 'annotation'
        ? checkAnnotation(doc.content, {
            paragraphs: doc.inputs.paragraphs,
            length: doc.inputs.length,
            sourceText: doc.inputs.source?.text ?? '',
          })
        : []),
      ...(doc.kind === 'lesson-plan-review'
        ? checkReview(doc.content, {
            sourceText: doc.inputs.source?.text ?? '',
            instructions: doc.inputs.instructions,
            trustedText: trustedSourceText(doc).join('\n'),
          })
        : []),
      ...findUnverifiedCodes(doc.content, trustedSourceText(doc)),
      ...(doc.kind === 'assessment' ||
      doc.kind === 'annotation' ||
      doc.kind === 'lesson-plan-review'
        ? []
        : findNonMeasurableVerbs(doc.content)),
    ],
    [doc],
  )

  if (warnings.length === 0) return null

  return (
    <div
      className="rounded-xl border border-primary/30 bg-primary-soft/60 p-4 text-sm"
      role="status"
      aria-label="Content checks"
    >
      <p className="flex items-center gap-2 font-medium text-primary-soft-foreground">
        <ShieldAlert className="size-4" aria-hidden />
        Please review {warnings.length} item{warnings.length === 1 ? '' : 's'}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-foreground">
        {warnings.slice(0, 8).map((w, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" aria-hidden />
            <span>{w.message}</span>
          </li>
        ))}
      </ul>
      {warnings.length > 8 && (
        <p className="mt-1 text-xs text-muted-foreground">…and {warnings.length - 8} more.</p>
      )}
    </div>
  )
}
