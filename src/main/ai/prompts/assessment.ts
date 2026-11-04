import type { PreparedPrompt } from '@shared/ai'
import { assessmentColumnCounts } from '@shared/calculation-rules'
import type { Attachment } from '@shared/conversations'
import type { AssessmentInputs, DocumentAction } from '@shared/documents'
import { BLOOM_GROUPS, DIFFICULTIES, QUESTION_TYPES, type QuestionType } from '@shared/teaching'
import { distributionColumns, distributionPercents } from '@shared/tos'
import { competencyCodeRule, curriculumGuidance, detailsTable, toPromptReference } from './common'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Item-writing rules per question type. */
const TYPE_RULES: Record<QuestionType, string> = {
  'multiple-choice':
    'Four options labelled A–D with exactly one correct answer. Distractors must be plausible and based on common misconceptions. Do not use "all of the above" or "none of the above". Avoid negative stems; if one is unavoidable, write NOT in capitals. Vary the position of the correct answer.',
  'true-false':
    'Each statement is entirely true or entirely false, tests one idea, and avoids absolute words (always, never) and double negatives. Learners write True or False. Balance true and false answers.',
  identification:
    'Each item has a single word or short phrase as its answer. Give enough context that only one answer fits.',
  matching:
    'Column A has the numbered items (premises); Column B has lettered options, with two more options than items so that the last match is not a giveaway. Keep each set about one homogeneous idea. Each item counts as one point.',
  'short-answer':
    'Each item asks for a 1–3 sentence response. Give a model answer and the key points needed for full credit.',
  essay:
    'Give a clear task, the point value, and a scoring rubric (criteria with points) in the scoring guide.',
  'problem-solving':
    'Use realistic, age-appropriate problems. Give the complete worked solution, the final answer, and the point allocation for each step in the scoring guide.',
}

function testParts(i: AssessmentInputs): string {
  let next = 1
  const rows = i.questionTypes
    .filter((q) => q.count > 0)
    .map((q, k) => {
      const range = q.count === 1 ? `${next}` : `${next}–${next + q.count - 1}`
      next += q.count
      return `| Test ${ROMAN[k]} | ${QUESTION_TYPES[q.type].label} | ${q.count} | ${range} |`
    })
  return [
    '| Part | Question type | Items | Item numbers |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

function bloomSection(i: AssessmentInputs): string[] {
  const counts = assessmentColumnCounts(i)
  if (i.tos) {
    const columns = distributionColumns(i.tos.mode)
    const head = ['Learning competency', ...columns.map((c) => c.label), 'Items']
    return [
      `## Table of specifications: ${i.tos.title}`,
      '',
      'Write exactly the number of items shown in each cell (competency × Bloom’s level). The column totals are the Bloom’s distribution of the whole test.',
      '',
      `| ${head.join(' | ')} |`,
      `| ${head.map(() => '---').join(' | ')} |`,
      ...i.tos.rows.map((r) => {
        const name = r.code.trim() ? `${r.competency} (${r.code.trim()})` : r.competency
        const total = r.cells.reduce((a, b) => a + b, 0)
        return `| ${name.replace(/\|/g, '\\|')} | ${r.cells.join(' | ')} | ${total} |`
      }),
      `| **Total** | ${counts.map((c) => `**${c}**`).join(' | ')} | **${i.itemCount}** |`,
      ...(i.tos.mode === 'grouped'
        ? ['', 'Within each grouped column, split the items between its two levels as appropriate.']
        : []),
    ]
  }
  const columns = distributionColumns(i.distribution.mode)
  const percents = distributionPercents(i.distribution)
  return [
    '## Bloom’s Revised Taxonomy distribution',
    '',
    '| Level | Share | Items |',
    '| --- | --- | --- |',
    ...columns.map((c, j) => `| ${c.label} | ${percents[j]}% | ${counts[j]} |`),
    `| **Total** | **100%** | **${i.itemCount}** |`,
    ...(i.distribution.mode === 'grouped'
      ? [
          '',
          `Groups: ${BLOOM_GROUPS.map((g) => `${g.label} = ${g.short.toLowerCase()}`).join('; ')}. Within each group, split the items between its two levels as appropriate.`,
        ]
      : []),
  ]
}

export interface AssessmentPromptInput {
  inputs: AssessmentInputs
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  currentContent?: string
  instruction?: string
}

export function buildAssessmentPrompt(p: AssessmentPromptInput): PreparedPrompt {
  const i = p.inputs
  const hasReferences = p.references.length > 0
  const types = i.questionTypes.filter((q) => q.count > 0)

  const instructions = [
    `You are an experienced teacher and test developer in ${p.country} helping a teacher write a classroom assessment.`,
    'This is a planning and writing task: do not create, edit or run files.',
  ].join('\n')

  const details = detailsTable([
    ['Subject', i.subject],
    ['Grade level', i.gradeLevel],
    ['Topic', i.topic],
    ['Learning competency', i.competency || 'Not provided'],
    ['Competency code', i.competencyCode || 'Not provided — do not invent one'],
    ['Number of questions', i.itemCount],
    [
      'Difficulty',
      `${DIFFICULTIES[i.difficulty].label} — ${DIFFICULTIES[i.difficulty].description}`,
    ],
    ['Explanations in answer key', i.includeExplanations ? 'Yes' : 'No'],
    ['Language', i.language],
  ])

  const answerKeyColumns = i.includeExplanations
    ? 'Item | Answer | Bloom’s level | Explanation'
    : 'Item | Answer | Bloom’s level'

  const sections = [
    '## Assessment details',
    '',
    details,
    '',
    '## Test parts',
    '',
    'Number the items continuously across all parts, in this order:',
    '',
    testParts(i),
    '',
    ...bloomSection(i),
    '',
    '## Item-writing rules',
    '',
    ...types.map((q) => `- **${QUESTION_TYPES[q.type].label}:** ${TYPE_RULES[q.type]}`),
    '- Every item must assess the topic and learning competency above; no trick questions or trivia.',
    '- Match each item’s cognitive demand to its Bloom’s level; do not label levels in the learners’ copy.',
    '- Items must be independent: one item must not give away the answer to another.',
    '- Use clear, grade-appropriate language and culturally appropriate, inclusive contexts.',
    '',
    '## Requirements',
    '',
    `- Context: ${p.country}. ${curriculumGuidance(i.curriculum, hasReferences)}`,
    `- Write in ${i.language}.`,
    `- ${competencyCodeRule(i.competencyCode)}`,
    hasReferences
      ? '- Base the items on the reference documents.'
      : '- No reference documents were supplied; keep content accurate and age-appropriate.',
    `- The test must have exactly ${i.itemCount} items, and the number of items per Bloom’s level must match the table above.`,
    '',
    '## Output format',
    '',
    '- Return only Markdown, with no commentary before or after it.',
    '- Start with a level-1 heading (the test title), then a short "General directions" paragraph.',
    `- One level-2 section per part (e.g. "## Test I. ${QUESTION_TYPES[types[0]?.type ?? 'multiple-choice'].label}") with its own directions, then the numbered items. Put multiple-choice options on separate lines as "A.", "B.", "C.", "D.". Write matching type as a Markdown table with Column A and Column B.`,
    `- Then "## Answer Key": a table with the columns ${answerKeyColumns}, one row per item from 1 to ${i.itemCount}.`,
    ...(types.some((q) => ['short-answer', 'essay', 'problem-solving'].includes(q.type))
      ? [
          '- Then "## Scoring Guide" with model answers, rubrics and point allocations for the open-ended items.',
        ]
      : []),
    '- End with "## Bloom’s Taxonomy Summary": a table of each level with the item numbers and the number of items, matching the distribution above.',
  ]
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }

  let request: string
  if (p.action === 'revise') {
    if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
    if (!p.currentContent?.trim()) throw new Error('There is no assessment to revise yet.')
    request = [
      ...sections,
      '',
      '## Current assessment',
      '',
      '````markdown',
      p.currentContent.trim(),
      '````',
      '',
      '## Revision requested',
      '',
      p.instruction.trim(),
      '',
      'Return the complete revised assessment (not only the changes), including the full answer key. Keep everything the teacher didn’t ask to change.',
    ].join('\n')
  } else {
    request = [...sections, '', 'Write the assessment now.'].join('\n')
  }

  return {
    title: p.title,
    instructions,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  }
}
