import type { PreparedPrompt } from '@shared/ai'
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_DIFFICULTIES,
  LEARNING_ENVIRONMENTS,
  parseActivities,
  type ActivityScope,
} from '@shared/activities'
import type { Attachment } from '@shared/conversations'
import type { ActivitiesInputs, DocumentAction } from '@shared/documents'
import { competencyCodeRule, curriculumGuidance, detailsTable, toPromptReference } from './common'

export interface ActivitiesPromptInput {
  inputs: ActivitiesInputs
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  currentContent?: string
  instruction?: string
  scope?: ActivityScope
}

/** The structure every activity must follow (labels stay in English so TeachMate can check them). */
function activityFormat(first: number, last: number): string[] {
  const range = first === last ? `${first}` : `${first}–${last}`
  return [
    `Write each activity (numbered ${range}) exactly in this structure. Keep the headings and bold labels in English, as written, so TeachMate can check them; write everything else in the lesson language.`,
    '',
    '````markdown',
    `## Activity ${first}: <Activity title>`,
    '',
    '- **Activity type:** <one of the selected categories>',
    '- **Learning purpose:** <one sentence: why learners do this activity>',
    '- **Aligned objectives:** <the objective(s) from the list above that this activity develops>',
    '- **Estimated duration:** <N> minutes',
    '',
    '### Materials and Resources',
    '- <only things from the available resources, or free/low-cost items>',
    '',
    '### Teacher Instructions',
    '- <what the teacher prepares and does, including grouping and time-keeping>',
    '',
    '### Student Instructions',
    '<clear, direct instructions addressed to learners>',
    '',
    '### Procedure',
    '1. <step> (<minutes> min)',
    '',
    '### Expected Output',
    '<what each learner, pair or group produces>',
    '',
    '### Assessment / Evaluation',
    '<how the teacher checks the objective is met, with simple criteria>',
    '',
    '### Differentiation',
    '- **Support:** <for learners who need help>',
    '- **Challenge:** <for advanced learners>',
    '````',
    '',
    'Include "### Differentiation" whenever it is appropriate (always for Differentiated Instruction activities); omit it only if it genuinely does not apply.',
  ]
}

export function buildActivitiesPrompt(p: ActivitiesPromptInput): PreparedPrompt {
  const i = p.inputs
  const hasReferences = p.references.length > 0
  const categories = ACTIVITY_CATEGORIES.filter((c) => i.categories.includes(c.id))
  const objectives = i.objectives
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)

  const instructions = [
    `You are an experienced teacher and instructional designer in ${p.country} helping a teacher plan classroom learning activities.`,
    'This is a planning and writing task: do not create, edit or run files.',
  ].join('\n')

  const details = detailsTable([
    ['Subject', i.subject],
    ['Grade level', i.gradeLevel],
    ['Quarter', `Quarter ${i.quarter}`],
    ['Lesson topic', i.topic],
    ['Learning competency', i.competency],
    ['Competency code', i.competencyCode || 'Not provided — do not invent one'],
    ['Time available for the activities', `${i.durationMinutes} minutes`],
    ['Number of activities', i.activityCount],
    ['Class size', `${i.classSize} learners`],
    ['Learning environment', LEARNING_ENVIRONMENTS[i.environment]],
    [
      'Available resources',
      i.resources.trim() ||
        'Not specified — assume a typical public school classroom with limited equipment',
    ],
    [
      'Difficulty level',
      `${ACTIVITY_DIFFICULTIES[i.difficulty].label} — ${ACTIVITY_DIFFICULTIES[i.difficulty].description}`,
    ],
    ['Language', i.language],
  ])

  const sections = [
    '## Lesson details',
    '',
    details,
    '',
    '## Learning objectives',
    '',
    ...(objectives.length > 0
      ? objectives.map((o, k) => `${k + 1}. ${o}`)
      : [
          'None were provided. Derive 2–4 measurable objectives from the learning competency, list them under "## Learning Objectives" before the activities, and align the activities to them.',
        ]),
    '',
    '## Activity categories to use',
    '',
    ...categories.map((c) => `- **${c.label}** — ${c.guidance}.`),
    '',
    categories.length > i.activityCount
      ? `There are more categories than activities: an activity may combine categories (e.g. a pair activity that is also inquiry-based). Name the main category as the activity type.`
      : 'Use each selected category at least once; sequence the activities in a sensible teaching order (e.g. motivation first, reflection last).',
    '',
    '## Requirements',
    '',
    `- Context: ${p.country}. ${curriculumGuidance(i.curriculum, hasReferences)}`,
    `- Write in ${i.language}.`,
    `- ${competencyCodeRule(i.competencyCode)}`,
    '- **Learner-centered and competency-based:** learners do the thinking and the work; every activity develops the learning competency.',
    '- **Aligned:** each activity states which objectives it develops, and its assessment checks exactly those objectives.',
    `- **Grade-level appropriate** for ${i.gradeLevel} learners, at the ${ACTIVITY_DIFFICULTIES[i.difficulty].label.toLowerCase()} difficulty level.`,
    `- **Realistic and achievable in time:** the activities are used together in one ${i.durationMinutes}-minute block, so their estimated durations must add up to no more than ${i.durationMinutes} minutes, including transitions. The minutes of each procedure must add up to that activity’s estimated duration.`,
    `- **Class size:** plan grouping, materials and management for ${i.classSize} learners (e.g. number of groups and learners per group).`,
    '- **Low-cost:** use only the available resources or free, everyday materials. Do not require purchases, paid software, internet or expensive equipment unless they are listed as available; offer a low-cost alternative where something might be missing.',
    '- Draw on cooperative learning, inquiry-based, experiential and project-based learning, and differentiated instruction where they fit the selected categories.',
    '- Include safety reminders when tools, electricity, chemicals or outdoor work are involved.',
    '- Use no made-up statistics, sources or claims; keep content accurate.',
    hasReferences
      ? '- Base the content on the reference documents.'
      : '- No reference documents were supplied; keep content accurate and age-appropriate.',
  ]
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }

  const current = () => {
    if (!p.currentContent?.trim())
      throw new Error('There are no activities yet. Generate them first.')
    return ['## Current activities', '', '````markdown', p.currentContent.trim(), '````']
  }

  let request: string
  if (p.scope?.type === 'activity') {
    const blocks = parseActivities(p.currentContent ?? '')
    const target = blocks[p.scope.index - 1]
    if (!target) throw new Error(`Activity ${p.scope.index} no longer exists.`)
    request = [
      ...sections,
      '',
      ...current(),
      '',
      `## Task: write a new version of Activity ${target.position}`,
      '',
      `Replace Activity ${target.position}${target.title ? ` (“${target.title}”)` : ''} with a different, better activity that serves the same place in the lesson: same activity type and aligned objectives, and no longer than its current estimated duration${target.minutes ? ` (${target.minutes} minutes)` : ''}. Do not repeat ideas from the other activities.`,
      ...(p.instruction?.trim() ? ['', `The teacher asks: ${p.instruction.trim()}`] : []),
      '',
      ...activityFormat(target.position, target.position),
      '',
      `Return ONLY the new Activity ${target.position}, starting with "## Activity ${target.position}:". Do not repeat the other activities and add no commentary.`,
    ].join('\n')
  } else if (p.scope?.type === 'alternatives') {
    const existing = parseActivities(p.currentContent ?? '').length
    const n = p.scope.count
    request = [
      ...sections,
      '',
      ...current(),
      '',
      `## Task: write ${n} alternative activit${n === 1 ? 'y' : 'ies'}`,
      '',
      `Write ${n} new activit${n === 1 ? 'y' : 'ies'} the teacher could use instead of current ones. Use different approaches from the current activities (another strategy, grouping or category from the list), keep them aligned to the same objectives, and keep each one within the time of the activity it could replace. Add the bullet "- **Can replace:** Activity <number>" after the estimated duration.`,
      ...(p.instruction?.trim() ? ['', `The teacher asks: ${p.instruction.trim()}`] : []),
      '',
      ...activityFormat(existing + 1, existing + n),
      '',
      `Return ONLY the ${n} new activit${n === 1 ? 'y' : 'ies'}, starting with "## Activity ${existing + 1}:". Do not repeat the current activities and add no commentary.`,
    ].join('\n')
  } else {
    const output = [
      '## Output format',
      '',
      'Return only Markdown, with no commentary before or after it:',
      '',
      `1. \`# Learning Activities: ${i.topic.trim() || '<topic>'}\``,
      '2. A short line: subject, grade level, quarter and total time.',
      ...(objectives.length === 0
        ? ['3. `## Learning Objectives` — the objectives you derived.']
        : []),
      `${objectives.length === 0 ? 4 : 3}. Exactly ${i.activityCount} activit${i.activityCount === 1 ? 'y' : 'ies'}.`,
      `${objectives.length === 0 ? 5 : 4}. \`## Time Plan\` — a table: Activity | Minutes, with the total (at most ${i.durationMinutes}).`,
      '',
      ...activityFormat(1, i.activityCount),
    ]
    if (p.action === 'revise') {
      if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
      request = [
        ...sections,
        '',
        ...output,
        '',
        ...current(),
        '',
        '## Revision requested',
        '',
        p.instruction.trim(),
        '',
        'Return the complete revised set of activities in the same format. Keep everything the teacher didn’t ask to change.',
      ].join('\n')
    } else {
      request = [...sections, '', ...output, '', 'Write the learning activities now.'].join('\n')
    }
  }

  return {
    title: p.title,
    instructions,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  }
}
