import { calculationErrors } from '@shared/calculation-rules'
import type { TeachingDocument } from '@shared/documents'
import { renderRubricMarkdown } from '@shared/rubric'
import { renderTosMarkdown } from '@shared/tos'
import { prepareTos } from '../storage/document-store'

/** Markdown for export: calculated documents are rendered fresh; others use their content. */
export function documentToMarkdown(doc: TeachingDocument): string {
  const problems = calculationErrors(doc)
  if (problems.length > 0) {
    throw new Error(`Fix the calculations before exporting: ${problems.join(' ')}`)
  }
  if (doc.kind === 'tos') {
    const prepared = prepareTos(doc)
    return renderTosMarkdown(prepared.title, prepared.inputs, prepared.table!)
  }
  if (doc.kind === 'rubric') return renderRubricMarkdown(doc.title, doc.rubric)
  const content = doc.content.trim()
  if (!content) throw new Error('There is no content to export yet.')
  // Plain-paragraph documents (e.g. annotations) get the title as a heading.
  return (/^#\s/.test(content) ? content : `# ${doc.title}\n\n${content}`) + '\n'
}
