import type { PreparedPrompt } from '@shared/ai'
import type { Attachment } from '@shared/conversations'
import { TASK_GROUPINGS, type DocumentAction, type PerformanceTaskInputs } from '@shared/documents'
import { competencyCodeRule, curriculumGuidance, detailsTable, toPromptReference } from './common'

export interface PerformanceTaskPromptInput {
  inputs: PerformanceTaskInputs
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  currentContent?: string
  instruction?: string
}

export function buildPerformanceTaskPrompt(p: PerformanceTaskPromptInput): PreparedPrompt {
  const i = p.inputs
  const hasReferences = p.references.length > 0
  const days = `${i.days} day${i.days === 1 ? '' : 's'}`

  const instructions = [
    `You are an experienced teacher in ${p.country} designing an authentic performance task that real classrooms can carry out.`,
    'This is a planning and writing task: do not create, edit or run files.',
  ].join('\n')

  const details = detailsTable([
    ['Subject', i.subject],
    ['Grade level', i.gradeLevel],
    ['Learning competency', i.competency],
    ['Competency code', i.competencyCode || 'Not provided — do not invent one'],
    ['Lesson topic', i.topic],
    ['Duration', `${days}, ${i.minutesPerDay} minutes of class time per day`],
    ['Learners work', TASK_GROUPINGS[i.grouping]],
    [
      'Available resources',
      i.resources.trim() || 'Not specified — assume a typical public school with limited equipment',
    ],
    [
      'Expected student output',
      i.expectedOutput.trim() || 'Not specified — propose one that fits the competency',
    ],
    ['Language', i.language],
  ])

  const sections = [
    '## Task details',
    '',
    details,
    '',
    '## Requirements',
    '',
    `- Context: ${p.country}. ${curriculumGuidance(i.curriculum, hasReferences)}`,
    `- Write in ${i.language}.`,
    `- ${competencyCodeRule(i.competencyCode)}`,
    '- **Practical and realistic:** the whole task must fit in the time above. Plan the work day by day and make sure each day’s activities fit the class time.',
    '- Use only the available resources. Do not require purchases, paid software or internet unless they are listed; give a low-cost or offline alternative for anything that might be missing.',
    '- Use a real-world scenario that learners in this grade can relate to (local community, school, family, livelihood), following the GRASPS model: Goal, Role, Audience, Situation, Product/Performance, Standards.',
    '- Learning objectives must be measurable and directly support the learning competency; the assessment criteria must assess exactly those objectives.',
    '- Include safety reminders where tools, electricity or outdoor work are involved, and an accommodation for learners who need support.',
    hasReferences
      ? '- Base the content on the reference documents.'
      : '- No reference documents were supplied; keep content accurate and age-appropriate.',
    '',
    '## Output format',
    '',
    'Return only Markdown, with no commentary before or after it, using exactly these sections in this order:',
    '',
    '1. `# <Performance task title>` — a short, engaging title.',
    '2. `## Learning Objectives` — 3–5 measurable objectives.',
    '3. `## Real-World Scenario` — a GRASPS scenario written to the learners (label each GRASPS element in bold).',
    `4. \`## Student Instructions\` — step-by-step instructions grouped by day (\`### Day 1\` … \`### Day ${i.days}\`), with minutes per step.`,
    '5. `## Materials Needed` — a list, marking low-cost or offline alternatives.',
    '6. `## Expected Output` — what learners produce and what a complete product contains.',
    `7. \`## Submission Requirements\` — format, what to submit, how, and when (by the end of Day ${i.days}).`,
    '8. `## Assessment Criteria` — a bullet list in the form `- **Criterion name** (weight %): what is assessed`. The weights must add up to 100%. These criteria will be used to build the rubric.',
  ]
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }

  let request: string
  if (p.action === 'revise') {
    if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
    if (!p.currentContent?.trim()) throw new Error('There is no performance task to revise yet.')
    request = [
      ...sections,
      '',
      '## Current performance task',
      '',
      '````markdown',
      p.currentContent.trim(),
      '````',
      '',
      '## Revision requested',
      '',
      p.instruction.trim(),
      '',
      'Return the complete revised performance task with all eight sections. Keep everything the teacher didn’t ask to change.',
    ].join('\n')
  } else {
    request = [...sections, '', 'Write the performance task now.'].join('\n')
  }

  return {
    title: p.title,
    instructions,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  }
}
