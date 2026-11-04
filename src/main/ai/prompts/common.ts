import type { PromptReference } from '@shared/ai'
import type { Attachment } from '@shared/conversations'
import { CURRICULUM_FRAMEWORKS, type CurriculumFramework } from '@shared/teaching'

export function toPromptReference(a: Attachment): PromptReference {
  return { name: a.name, text: a.text, truncated: a.truncated, charCount: a.charCount }
}

/** Markdown table of label/value rows; empty values are shown as "Not specified". */
export function detailsTable(rows: Array<[string, string | number]>): string {
  const esc = (v: string) => v.replace(/\|/g, '\\|').replace(/\n+/g, ' ')
  return [
    '| Detail | Value |',
    '| --- | --- |',
    ...rows.map(([k, v]) => `| ${k} | ${esc(String(v).trim() || 'Not specified')} |`),
  ].join('\n')
}

export function curriculumGuidance(
  curriculum: CurriculumFramework,
  hasReferences: boolean,
): string {
  switch (curriculum) {
    case 'ilaw':
      return hasReferences
        ? 'Follow the ILAW curriculum and its lesson structure as described in the reference documents.'
        : 'Follow the ILAW curriculum. No ILAW reference document was supplied, so use the DepEd K-12 procedure steps for the lesson structure and say so.'
    case 'matatag':
      return 'Follow the DepEd MATATAG curriculum and its lesson structure.'
    case 'k12':
      return 'Follow the DepEd K-12 Basic Education Curriculum and the lesson-plan formats of DepEd Order No. 42, s. 2016.'
    case 'auto':
      return hasReferences
        ? `Decide from the reference documents whether they follow the ILAW curriculum, the MATATAG curriculum or the K-12 curriculum, follow that one, and state which you used. If they don't make it clear, use the K-12 format (${CURRICULUM_FRAMEWORKS.k12.description})`
        : 'No reference documents were supplied, so use the DepEd K-12 format (DepEd Order No. 42, s. 2016) and say so.'
  }
}

/**
 * Rules for curriculum codes. TeachMate never generates codes, and the model
 * must not invent them either.
 */
export function competencyCodeRule(code: string): string {
  return code.trim()
    ? `The teacher supplied the competency code "${code.trim()}". Use it exactly as written. Do not add any other curriculum or competency codes unless they appear word for word in the reference documents.`
    : 'No competency code was supplied. Do NOT invent, guess or reconstruct official DepEd curriculum or competency codes. Where a code would normally appear, write "Code: not provided". Only use a code if it appears word for word in the reference documents.'
}
