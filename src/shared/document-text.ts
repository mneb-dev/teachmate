import { scopeLabel } from './activities'
import type { DocumentScope, DocumentSummary, TeachingDocument } from './documents'
import { REVIEW_DEPTHS, revisionLabel } from './review'
import { LESSON_PLAN_FORMATS } from './teaching'

/** e.g. "Activity 2 (regenerate)" or "Revised lesson plan (objectives)". */
export function requestScopeLabel(scope: DocumentScope): string {
  return scope.type === 'revision' ? revisionLabel(scope) : scopeLabel(scope)
}

function kindLabel(doc: TeachingDocument): string {
  switch (doc.kind) {
    case 'lesson-plan':
      return LESSON_PLAN_FORMATS[doc.inputs.format].short
    case 'learning-objectives':
      return 'Objectives'
    case 'learning-activities':
      return 'Activities'
    case 'assessment':
      return 'Assessment'
    case 'tos':
      return 'TOS'
    case 'performance-task':
      return 'Performance Task'
    case 'rubric':
      return 'Rubric'
    case 'annotation':
      return 'Annotation'
    case 'lesson-plan-review':
      return 'Review'
  }
}

function mainTopic(doc: TeachingDocument): string {
  switch (doc.kind) {
    case 'tos':
      return doc.inputs.examTitle
    case 'rubric':
      return doc.inputs.taskTitle
    case 'annotation':
    case 'lesson-plan-review':
      return doc.inputs.source?.title ?? ''
    default:
      return doc.inputs.topic
  }
}

/** Suggested title from the form inputs, e.g. "DLL — Grade 8 Computer Education / ICT: Spreadsheets". */
export function suggestedTitle(doc: TeachingDocument): string {
  const { subject, gradeLevel } = doc.inputs
  const subjectPart = [gradeLevel, subject].filter((s) => s.trim()).join(' ')
  const base = [kindLabel(doc), subjectPart].filter(Boolean).join(' — ')
  const topic = mainTopic(doc).trim()
  return (topic ? `${base}: ${topic}` : base).slice(0, 160)
}

export function documentSubtitle(doc: TeachingDocument): string {
  let lead: string
  switch (doc.kind) {
    case 'lesson-plan':
      lead = LESSON_PLAN_FORMATS[doc.inputs.format].short
      break
    case 'learning-objectives':
      lead = 'Learning objectives'
      break
    case 'learning-activities':
      lead = `Learning activities · ${doc.inputs.activityCount} activit${doc.inputs.activityCount === 1 ? 'y' : 'ies'} · ${doc.inputs.durationMinutes} min`
      break
    case 'assessment':
      lead = `Assessment · ${doc.inputs.itemCount} items`
      break
    case 'tos':
      lead = `TOS · ${doc.inputs.totalItems} items`
      break
    case 'performance-task':
      lead = `Performance task · ${doc.inputs.days} day${doc.inputs.days === 1 ? '' : 's'}`
      break
    case 'rubric':
      lead = `${doc.rubric.type === 'analytic' ? 'Analytic' : 'Holistic'} rubric · ${doc.inputs.levelCount} levels`
      break
    case 'annotation':
      lead = `DLL annotation · ${doc.inputs.paragraphs} paragraph${doc.inputs.paragraphs === 1 ? '' : 's'}`
      break
    case 'lesson-plan-review':
      lead = `${REVIEW_DEPTHS[doc.inputs.depth].label} · ${LESSON_PLAN_FORMATS[doc.inputs.planType].short}`
      break
  }
  return [lead, doc.inputs.subject, doc.inputs.gradeLevel].filter((p) => p.trim()).join(' · ')
}

/**
 * Text the teacher supplied (competencies, codes, instructions, references).
 * Curriculum codes found in generated content are only trusted if they appear here.
 */
export function trustedSourceText(doc: TeachingDocument): string[] {
  const refs = doc.references.map((r) => r.text)
  switch (doc.kind) {
    case 'tos':
      return [...doc.inputs.competencies.flatMap((c) => [c.competency, c.code]), ...refs]
    case 'assessment':
      return [
        doc.inputs.competencyCode,
        doc.inputs.competency,
        doc.inputs.instructions,
        ...(doc.inputs.tos?.rows.flatMap((r) => [r.competency, r.code]) ?? []),
        ...refs,
      ]
    case 'learning-activities':
      return [
        doc.inputs.competencyCode,
        doc.inputs.competency,
        doc.inputs.objectives,
        doc.inputs.instructions,
        ...refs,
      ]
    case 'annotation':
      return [doc.inputs.focus, doc.inputs.instructions, doc.inputs.source?.text ?? '', ...refs]
    case 'lesson-plan-review':
      return [
        doc.inputs.source?.text ?? '',
        doc.inputs.formatRequirements,
        doc.inputs.instructions,
        ...refs,
      ]
    case 'rubric':
      return [
        doc.inputs.competencyCode,
        doc.inputs.competency,
        doc.inputs.instructions,
        doc.inputs.task?.text ?? '',
        ...refs,
      ]
    default:
      return [doc.inputs.competencyCode, doc.inputs.competency, doc.inputs.instructions, ...refs]
  }
}

export function summarizeDocument(doc: TeachingDocument): DocumentSummary {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    subtitle: documentSubtitle(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    hasContent: doc.content.trim().length > 0,
  }
}
