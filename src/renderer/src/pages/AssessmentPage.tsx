import type { TeachingDocument } from '@shared/documents'
import { checkTosTable } from '@shared/tos'
import { AssessmentForm } from '@renderer/features/assessment/AssessmentForm'
import { DocumentToolPage } from '@renderer/features/documents/DocumentToolPage'
import { teachmate } from '@renderer/lib/ipc'

/**
 * `?fromTos=<id>` (from the TOS tool) starts a new assessment whose item count
 * and Bloom's distribution come from that saved Table of Specifications.
 */
function presetFromParams(params: URLSearchParams) {
  const tosId = params.get('fromTos')
  if (!tosId) return undefined
  return async (doc: TeachingDocument): Promise<TeachingDocument> => {
    if (doc.kind !== 'assessment') return doc
    const tos = await teachmate.documents.get(tosId)
    if (!tos || tos.kind !== 'tos' || !tos.table || !checkTosTable(tos.inputs, tos.table).ok) {
      throw new Error(
        'That Table of Specifications could not be used. Open it, fix any errors and save it first.',
      )
    }
    const t = tos.inputs
    return {
      ...doc,
      inputs: {
        ...doc.inputs,
        subject: t.subject,
        gradeLevel: t.gradeLevel,
        topic: t.examTitle,
        competency: t.competencies.map((c) => c.competency).join('\n'),
        itemCount: t.totalItems,
        // Start with all multiple choice; the teacher adjusts the mix.
        questionTypes: [{ type: 'multiple-choice', count: t.totalItems }],
        distribution: structuredClone(t.distribution),
        tos: {
          sourceId: tos.id,
          title: tos.title,
          mode: tos.table.mode,
          rows: t.competencies.map((c, i) => ({
            competency: c.competency,
            code: c.code,
            cells: [...tos.table!.rows[i].cells],
          })),
        },
      },
    }
  }
}

export function AssessmentPage() {
  return (
    <DocumentToolPage
      kind="assessment"
      navId="assessments"
      noun="assessment"
      Form={AssessmentForm}
      presetFromParams={presetFromParams}
    />
  )
}
