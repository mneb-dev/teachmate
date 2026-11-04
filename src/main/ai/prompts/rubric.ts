import type { PreparedPrompt } from '@shared/ai'
import type { Attachment } from '@shared/conversations'
import type { DocumentAction, RubricInputs } from '@shared/documents'
import { renderRubricMarkdown, rubricTotal, type RubricData } from '@shared/rubric'
import { competencyCodeRule, curriculumGuidance, detailsTable, toPromptReference } from './common'

const TASK_CONTEXT_MAX_CHARS = 6_000

export interface RubricPromptInput {
  inputs: RubricInputs
  rubric: RubricData
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  instruction?: string
}

/**
 * Ask the model for criteria and descriptors only, in a strict table that
 * TeachMate reads back into the rubric. All numbers stay with TeachMate.
 */
export function buildRubricPrompt(p: RubricPromptInput): PreparedPrompt {
  const i = p.inputs
  const r = p.rubric
  const hasReferences = p.references.length > 0
  const analytic = r.type === 'analytic'
  const levels = analytic ? r.levels.map((l) => l.label) : r.holistic.map((h) => h.label)
  const existingNames = analytic ? r.criteria.map((c) => c.name.trim()).filter(Boolean) : []

  const instructions = [
    `You are an experienced teacher in ${p.country} writing a clear, fair ${analytic ? 'analytic' : 'holistic'} rubric.`,
    'This is a planning and writing task: do not create, edit or run files.',
  ].join('\n')

  const details = detailsTable([
    ['Subject', i.subject],
    ['Grade level', i.gradeLevel],
    ['Task or product assessed', i.taskTitle],
    ['Learning competency', i.competency || 'Not provided'],
    ['Competency code', i.competencyCode || 'Not provided — do not invent one'],
    [
      'Rubric type',
      analytic
        ? 'Analytic (one row per criterion)'
        : 'Holistic (one overall description per level)',
    ],
    ['Performance levels (highest first)', levels.join(' → ')],
    ...(analytic ? ([['Number of criteria', i.criteriaCount]] as Array<[string, number]>) : []),
    ['Language', i.language],
  ])

  const table = analytic
    ? [
        `| Criterion | ${levels.join(' | ')} |`,
        `| --- | ${levels.map(() => '---').join(' | ')} |`,
        `| <criterion name> | ${levels.map((l) => `<what ${l.toLowerCase()} work looks like>`).join(' | ')} |`,
      ]
    : ['| Level | Description |', '| --- | --- |', ...levels.map((l) => `| ${l} | <description> |`)]

  const sections = [
    '## Rubric details',
    '',
    details,
    '',
    '## Requirements',
    '',
    `- Context: ${p.country}. ${curriculumGuidance(i.curriculum, hasReferences)}`,
    `- Write in ${i.language}.`,
    `- ${competencyCodeRule(i.competencyCode)}`,
    analytic
      ? `- Write exactly ${i.criteriaCount} criteria. Each criterion assesses one distinct, observable quality of the task or product, aligned with the competency.`
      : '- Each level description summarizes the overall quality of the whole product or performance.',
    ...(existingNames.length
      ? [
          `- Use these criteria the teacher already chose, in this order: ${existingNames.join('; ')}. Add others only if fewer than ${i.criteriaCount}.`,
        ]
      : []),
    '- Descriptions must be specific and observable, parallel across levels (the same aspects at each level), and show a clear progression from highest to lowest.',
    '- Avoid vague words such as "good", "poor" or "excellent work"; describe what the work actually shows. Avoid counting-only descriptions unless quantity really matters.',
    '- Do NOT include points, scores, weights or totals anywhere. TeachMate calculates all points and the total score.',
    hasReferences
      ? '- Base the criteria on the reference documents.'
      : '- No reference documents were supplied; keep the rubric grade-appropriate.',
    '',
    '## Output format',
    '',
    'Return only one Markdown table in exactly this shape, with no text before or after it:',
    '',
    ...table,
  ]
  if (i.task?.text.trim()) {
    sections.push(
      '',
      `## The performance task (“${i.task.title}”)`,
      '',
      '````markdown',
      i.task.text.trim().slice(0, TASK_CONTEXT_MAX_CHARS),
      '````',
    )
  }
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }

  let request: string
  if (p.action === 'revise') {
    if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
    request = [
      ...sections,
      '',
      '## Current rubric',
      '',
      '````markdown',
      renderRubricMarkdown(p.title, r).trim(),
      '````',
      '',
      `(Current total: ${rubricTotal(r)} points — calculated by TeachMate; do not change or repeat the numbers.)`,
      '',
      '## Revision requested',
      '',
      p.instruction.trim(),
      '',
      'Return the complete revised rubric as one table in the format above.',
    ].join('\n')
  } else {
    request = [...sections, '', 'Write the rubric table now.'].join('\n')
  }

  return {
    title: p.title,
    instructions,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  }
}
