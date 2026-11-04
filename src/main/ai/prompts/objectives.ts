import type { PreparedPrompt } from '@shared/ai'
import type { Attachment } from '@shared/conversations'
import type { DocumentAction, ObjectivesInputs } from '@shared/documents'
import { BLOOM_LEVELS, LEARNING_DOMAINS, NON_MEASURABLE_VERBS } from '@shared/teaching'
import { competencyCodeRule, curriculumGuidance, detailsTable, toPromptReference } from './common'

export interface ObjectivesPromptInput {
  inputs: ObjectivesInputs
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  currentContent?: string
  instruction?: string
}

export function buildObjectivesPrompt(p: ObjectivesPromptInput): PreparedPrompt {
  const i = p.inputs
  const hasReferences = p.references.length > 0
  const levels = BLOOM_LEVELS.filter((b) => i.bloomLevels.includes(b.id))
  const domains = LEARNING_DOMAINS.filter((d) => i.domains.includes(d.id))
  const cognitive = i.domains.includes('cognitive')

  const instructions = [
    `You are an experienced teacher and curriculum specialist in ${p.country} helping a teacher write measurable learning objectives.`,
    'This is a planning and writing task: do not create, edit or run files.',
  ].join('\n')

  const details = detailsTable([
    ['Subject', i.subject],
    ['Grade level', i.gradeLevel],
    ['Topic', i.topic],
    ['Learning competency', i.competency || 'Not provided'],
    ['Competency code', i.competencyCode || 'Not provided — do not invent one'],
    ['Time allotment', `${i.durationMinutes} minutes`],
    ['Language', i.language],
  ])

  const levelLines = levels.map(
    (b) => `- **${b.label}** — ${b.description} Example verbs: ${b.verbs.join(', ')}.`,
  )
  const domainLines = domains.map(
    (d) =>
      `- **${d.label}** — ${d.description}${d.verbs.length ? ` Example verbs: ${d.verbs.join(', ')}.` : ''}`,
  )

  const counts = [
    cognitive
      ? `- Cognitive: ${i.objectivesPerLevel} objective${i.objectivesPerLevel > 1 ? 's' : ''} for each selected Bloom’s level (${levels.map((b) => b.label).join(', ')}).`
      : `- Use the selected Bloom’s levels (${levels.map((b) => b.label).join(', ')}) to set the complexity of the objectives.`,
    ...domains
      .filter((d) => d.id !== 'cognitive')
      .map((d) => `- ${d.label}: 1–2 objectives, only where they genuinely fit this topic.`),
  ]

  const sections = [
    '## Lesson details',
    '',
    details,
    '',
    '## Bloom’s Revised Taxonomy levels to cover',
    '',
    ...levelLines,
    '',
    '## Learning domains',
    '',
    ...domainLines,
    '',
    '## How many objectives',
    '',
    ...counts,
    '',
    '## Requirements',
    '',
    `- Context: ${p.country}. ${curriculumGuidance(i.curriculum, hasReferences)}`,
    `- Write in ${i.language}.`,
    `- ${competencyCodeRule(i.competencyCode)}`,
    '- Each objective starts with exactly one observable, measurable action verb that matches its Bloom’s level.',
    `- Never use non-measurable verbs as the main verb: ${NON_MEASURABLE_VERBS.join(', ')}.`,
    '- Where practical, use the ABCD form: Audience (learners), Behavior (verb + content), Condition (given what / using what), Degree (criterion, e.g. "with at least 80% accuracy").',
    `- Every objective must support the learning competency and be achievable within ${i.durationMinutes} minutes.`,
    '- **Alignment:** for each objective, give the assessment evidence that would show it was achieved; the evidence must match the verb and level (e.g. "design" needs a product, not a quiz item).',
    '- Order objectives from lower to higher Bloom’s levels.',
    '',
    '## Output format',
    '',
    '- Return only Markdown, no commentary before or after it.',
    `- Start with "# Learning Objectives: ${i.topic.trim() || 'Topic'}" and then the line "At the end of the lesson, learners will be able to:".`,
    '- Then a table with the columns: # | Objective | Bloom’s level | Domain | Assessment evidence.',
    '- End with "## Alignment notes": 2–4 bullet points on how the objectives cover the competency and progress across levels.',
  ]
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }

  let request: string
  if (p.action === 'revise') {
    if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
    if (!p.currentContent?.trim()) throw new Error('There are no objectives to revise yet.')
    request = [
      ...sections,
      '',
      '## Current objectives',
      '',
      '````markdown',
      p.currentContent.trim(),
      '````',
      '',
      '## Revision requested',
      '',
      p.instruction.trim(),
      '',
      'Return the complete revised set of objectives in the same format. Keep everything the teacher didn’t ask to change.',
    ].join('\n')
  } else {
    request = [...sections, '', 'Write the learning objectives now.'].join('\n')
  }

  return {
    title: p.title,
    instructions,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  }
}
