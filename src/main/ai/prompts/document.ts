import type { PreparedPrompt } from '@shared/ai'
import { documentInputErrors } from '@shared/calculation-rules'
import type { DocumentAction, DocumentScope, TeachingDocument } from '@shared/documents'
import { buildActivitiesPrompt } from './activities'
import { buildAnnotationPrompt } from './annotation'
import { buildAssessmentPrompt } from './assessment'
import { buildLessonPlanPrompt } from './lesson-plan'
import { buildObjectivesPrompt } from './objectives'
import { buildPerformanceTaskPrompt } from './performance-task'
import { buildReviewPrompt } from './review'
import { buildRubricPrompt } from './rubric'

export class InvalidInputsError extends Error {}

/**
 * Validate a document's form inputs and build its prompt. Throws
 * InvalidInputsError listing the problems when the form is incomplete.
 */
export function buildDocumentPrompt(
  doc: TeachingDocument,
  action: DocumentAction,
  instruction: string | undefined,
  country: string,
  scope?: DocumentScope,
): PreparedPrompt {
  if (scope?.type === 'revision' && doc.kind !== 'lesson-plan-review') {
    throw new InvalidInputsError('Only a lesson plan review can produce a revised lesson plan.')
  }
  if (scope && scope.type !== 'revision' && doc.kind !== 'learning-activities') {
    throw new InvalidInputsError('Only learning activities can be regenerated one at a time.')
  }
  if (doc.kind === 'tos') {
    throw new InvalidInputsError(
      'A Table of Specifications is calculated in TeachMate. Use “Build assessment from this TOS” to write the test.',
    )
  }
  const messages = Object.values(documentInputErrors(doc)).filter(Boolean)
  if (messages.length > 0) {
    throw new InvalidInputsError(`Please complete the form first: ${messages.join(' ')}`)
  }

  const common = {
    references: doc.references,
    country,
    title: doc.title,
    action,
    currentContent: doc.content,
    instruction,
  }
  switch (doc.kind) {
    case 'lesson-plan':
      return buildLessonPlanPrompt({ ...common, inputs: doc.inputs })
    case 'learning-objectives':
      return buildObjectivesPrompt({ ...common, inputs: doc.inputs })
    case 'learning-activities':
      return buildActivitiesPrompt({
        ...common,
        inputs: doc.inputs,
        scope: scope?.type === 'revision' ? undefined : scope,
      })
    case 'assessment':
      return buildAssessmentPrompt({ ...common, inputs: doc.inputs })
    case 'performance-task':
      return buildPerformanceTaskPrompt({ ...common, inputs: doc.inputs })
    case 'rubric':
      return buildRubricPrompt({ ...common, inputs: doc.inputs, rubric: doc.rubric })
    case 'annotation':
      return buildAnnotationPrompt({ ...common, inputs: doc.inputs })
    case 'lesson-plan-review':
      return buildReviewPrompt({
        ...common,
        inputs: doc.inputs,
        revisions: doc.revisions,
        scope: scope?.type === 'revision' ? scope : undefined,
      })
  }
}
