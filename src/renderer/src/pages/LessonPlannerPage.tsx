import {
  LESSON_PLAN_FORMATS,
  LESSON_PLAN_FORMAT_IDS,
  type LessonPlanFormat,
} from '@shared/teaching'
import type { TeachingDocument } from '@shared/documents'
import { DocumentToolPage } from '@renderer/features/documents/DocumentToolPage'
import { LessonPlanForm } from '@renderer/features/lesson-planner/LessonPlanForm'

/** `?new=dlp` (e.g. from a dashboard quick action) presets the format of a new plan. */
function presetFromParams(params: URLSearchParams) {
  const format = params.get('new') as LessonPlanFormat | null
  if (!format || !LESSON_PLAN_FORMAT_IDS.includes(format)) return undefined
  return (doc: TeachingDocument): TeachingDocument =>
    doc.kind === 'lesson-plan'
      ? {
          ...doc,
          inputs: {
            ...doc.inputs,
            format,
            sessions: Math.max(LESSON_PLAN_FORMATS[format].minSessions, doc.inputs.sessions),
          },
        }
      : doc
}

export function LessonPlannerPage() {
  return (
    <DocumentToolPage
      kind="lesson-plan"
      navId="lesson-planner"
      noun="lesson plan"
      Form={LessonPlanForm}
      presetFromParams={presetFromParams}
    />
  )
}
