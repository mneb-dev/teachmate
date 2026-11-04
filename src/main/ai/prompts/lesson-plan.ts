import type { PreparedPrompt } from '@shared/ai'
import type { DocumentAction, LessonPlanInputs } from '@shared/documents'
import {
  CURRICULUM_FRAMEWORKS,
  LESSON_PLAN_FORMATS,
  type CurriculumFramework,
  type LessonPlanFormat,
} from '@shared/teaching'
import { competencyCodeRule, curriculumGuidance, detailsTable, toPromptReference } from './common'
import type { Attachment } from '@shared/conversations'

/** DO 42, s. 2016 procedure steps used by the K-12 DLL and DLP. */
const K12_PROCEDURES = [
  'A. Reviewing previous lesson or presenting the new lesson',
  'B. Establishing a purpose for the lesson',
  'C. Presenting examples/instances of the new lesson',
  'D. Discussing new concepts and practicing new skills #1',
  'E. Discussing new concepts and practicing new skills #2',
  'F. Developing mastery (leads to formative assessment)',
  'G. Finding practical applications of concepts and skills in daily living',
  'H. Making generalizations and abstractions about the lesson',
  'I. Evaluating learning',
  'J. Additional activities for application or remediation',
]

/** Phases of the MATATAG teaching and learning procedure. */
const MATATAG_PROCEDURES = [
  'Activating Prior Knowledge',
  'Lesson Purpose/Intention',
  'Lesson Language Practice',
  'Reading the Key Idea/Stem',
  'Developing Understanding of the Key Idea/Stem',
  'Deepening Understanding of the Key Idea/Stem',
  'Making Generalizations',
  'Evaluating Learning: Formative Assessment and Teacher’s Reflection',
]

/**
 * Phases of the ILAW teaching and learning procedure.
 * TODO: fill in the official ILAW phases, in order. While this is empty, the
 * model follows the ILAW phases found in the reference documents.
 */
const ILAW_PROCEDURES: string[] = []

const ILAW_FROM_REFERENCES =
  '   - Follow the ILAW lesson phases from the reference documents, in order, using their exact names.'

const list = (items: string[]) => items.map((s) => `   - ${s}`).join('\n')

function ilawSteps(hasReferences: boolean): string | null {
  if (ILAW_PROCEDURES.length > 0) return list(ILAW_PROCEDURES)
  return hasReferences ? ILAW_FROM_REFERENCES : null
}

function procedureSteps(curriculum: CurriculumFramework, hasReferences: boolean): string {
  if (curriculum === 'matatag') return list(MATATAG_PROCEDURES)
  if (curriculum === 'k12') return list(K12_PROCEDURES)
  if (curriculum === 'ilaw') return ilawSteps(hasReferences) ?? list(K12_PROCEDURES)
  const notes = [`If you follow MATATAG, use its phases instead: ${MATATAG_PROCEDURES.join('; ')}.`]
  if (ILAW_PROCEDURES.length > 0) {
    notes.push(`If you follow ILAW, use its phases instead: ${ILAW_PROCEDURES.join('; ')}.`)
  } else if (hasReferences) {
    notes.push('If you follow ILAW, use the ILAW phases from the reference documents instead.')
  }
  return `${list(K12_PROCEDURES)}\n${notes.map((n) => `   (${n})`).join('\n')}`
}

function formatStructure(
  format: LessonPlanFormat,
  i: LessonPlanInputs,
  hasReferences: boolean,
): string {
  const steps = procedureSteps(i.curriculum, hasReferences)
  const sessions = i.sessions
  const minutes = i.durationMinutes
  const header =
    'Start with a header table: School, Teacher, Teaching Dates and Time (leave as "________" for the teacher to fill in), Grade Level, Learning Area, Quarter, Week.'

  switch (format) {
    case 'dll':
      return [
        `Daily Lesson Log (DLL) covering ${sessions} session${sessions > 1 ? 's' : ''} of ${minutes} minutes.`,
        header,
        `Use a table with one column per session (${Array.from({ length: sessions }, (_, k) => `Session ${k + 1}`).join(', ')}) and these rows:`,
        '1. I. OBJECTIVES — A. Content Standards; B. Performance Standards; C. Learning Competencies/Objectives (with the competency code rule below)',
        '2. II. CONTENT',
        '3. III. LEARNING RESOURCES — A. References (Teacher’s Guide pages, Learner’s Materials pages, Textbook pages, Additional materials); B. Other learning resources',
        `4. IV. PROCEDURES:\n${steps}`,
        '5. V. REMARKS',
        '6. VI. REFLECTION (prompts for the teacher to answer after teaching)',
      ].join('\n')
    case 'dlp':
      return [
        `Detailed Lesson Plan (DLP)${sessions > 1 ? `, one complete plan per session for ${sessions} sessions` : ''}, ${minutes} minutes per session.`,
        header,
        'Sections:',
        '1. I. OBJECTIVES — Content Standards, Performance Standards, Learning Competency, and specific objectives (knowledge, skills, attitudes)',
        '2. II. CONTENT / SUBJECT MATTER — topic, key concepts, values integration',
        '3. III. LEARNING RESOURCES — references and materials',
        `4. IV. PROCEDURES — a two-column table "Teacher’s Activity | Learners’ Expected Response" with scripted questions and expected answers for each step:\n${steps}`,
        '5. V. EVALUATION — the actual assessment items with an answer key',
        '6. VI. ASSIGNMENT / ADDITIONAL ACTIVITIES',
        '7. VII. REMARKS and VIII. REFLECTION',
      ].join('\n')
    case 'semi-detailed':
      return [
        `Semi-Detailed Lesson Plan${sessions > 1 ? `, one plan per session for ${sessions} sessions` : ''}, ${minutes} minutes per session.`,
        header,
        'Sections:',
        '1. I. OBJECTIVES (knowledge, skills, attitudes)',
        '2. II. SUBJECT MATTER — topic, references, materials, values integration',
        `3. III. PROCEDURE — describe what the teacher and learners do in each step, without scripted dialogue:\n${steps}`,
        '4. IV. EVALUATION — assessment items with an answer key',
        '5. V. ASSIGNMENT',
      ].join('\n')
    case 'multi-day':
      return [
        `Multi-Day Lesson Plan: one lesson taught over ${sessions} sessions of ${minutes} minutes each.`,
        header,
        'Sections:',
        '1. Lesson overview — standards, competency, and the full set of objectives for the whole lesson',
        `2. "Day 1" … "Day ${sessions}" — for each day: objectives addressed that day, a timed procedure (minutes per step, adding up to ${minutes}), materials, and a formative check`,
        `   Use these procedure steps across the days:\n${steps}`,
        '3. Summative assessment for the whole lesson, with an answer key or rubric',
        '4. Differentiation and remediation plan',
      ].join('\n')
    case 'weekly':
      return [
        `Weekly Lesson Plan for Week ${i.week}, ${sessions} session${sessions > 1 ? 's' : ''} of ${minutes} minutes.`,
        header,
        'Sections:',
        '1. Weekly standards and learning competency',
        '2. A table: Day | Objectives | Key learning activities (with minutes) | Assessment | Materials',
        '3. End-of-week assessment with an answer key or rubric',
        '4. Notes on differentiation, remediation and enrichment',
      ].join('\n')
  }
}

function requirements(i: LessonPlanInputs, country: string, hasReferences: boolean): string {
  return [
    '## Requirements',
    '',
    `- Context: ${country}. ${curriculumGuidance(i.curriculum, hasReferences)}`,
    `- Write in ${i.language}.`,
    `- ${competencyCodeRule(i.competencyCode)}`,
    '- Do not invent page numbers, DepEd memoranda or official document numbers. If you don’t know a page number, write "pp. ____" for the teacher to fill in.',
    '- Objectives must be measurable and observable. Tag each with its Bloom’s Revised Taxonomy level and domain (cognitive, psychomotor or affective). Never use verbs such as "understand", "know", "learn" or "appreciate" as the main verb.',
    '- **Alignment is mandatory:** every objective must be practiced by at least one learning activity and checked by at least one assessment item, and every activity and assessment must serve an objective.',
    `- Timing must be realistic: the steps of each session must add up to ${i.durationMinutes} minutes. Show the minutes for each step.`,
    '- Include differentiation for struggling and advanced learners, and a low-resource alternative where activities need computers, internet or electricity.',
    hasReferences
      ? '- Base the content on the reference documents. When you use them, say which document a part comes from.'
      : '- No reference documents were supplied; keep content accurate and age-appropriate.',
    '',
    '## Output format',
    '',
    '- Return only the lesson plan in Markdown. No commentary before or after it.',
    '- Start with a level-1 heading containing the lesson title.',
    '- Use Markdown tables where the format has columns.',
    '- End with a section "## Alignment check": a table with the columns Objective | Bloom’s level / domain | Learning activities | Assessment.',
  ].join('\n')
}

export interface LessonPlanPromptInput {
  inputs: LessonPlanInputs
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  currentContent?: string
  instruction?: string
}

export function buildLessonPlanPrompt(p: LessonPlanPromptInput): PreparedPrompt {
  const i = p.inputs
  const format = LESSON_PLAN_FORMATS[i.format]
  const hasReferences = p.references.length > 0

  const instructions = [
    `You are an experienced teacher and instructional designer in ${p.country} helping a teacher write a ${format.label}.`,
    'This is a planning and writing task: do not create, edit or run files.',
  ].join('\n')

  const details = detailsTable([
    ['Lesson plan format', format.label],
    ['Subject', i.subject],
    ['Grade level', i.gradeLevel],
    ['Quarter', `Quarter ${i.quarter}`],
    ['Week', `Week ${i.week}`],
    ['Topic', i.topic],
    ['Learning competency', i.competency],
    ['Competency code', i.competencyCode || 'Not provided — do not invent one'],
    ['Time allotment', `${i.durationMinutes} minutes per session`],
    ['Number of sessions', i.sessions],
    [
      'Curriculum',
      i.curriculum === 'auto'
        ? 'Decide from references (ILAW, MATATAG or K-12)'
        : CURRICULUM_FRAMEWORKS[i.curriculum].label,
    ],
    ['Language', i.language],
  ])

  const sections = [
    '## Lesson details',
    '',
    details,
    '',
    '## Required structure',
    '',
    formatStructure(i.format, i, hasReferences),
    '',
    requirements(i, p.country, hasReferences),
  ]
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }

  let request: string
  if (p.action === 'revise') {
    if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
    if (!p.currentContent?.trim()) throw new Error('There is no lesson plan to revise yet.')
    request = [
      ...sections,
      '',
      '## Current lesson plan',
      '',
      '````markdown',
      p.currentContent.trim(),
      '````',
      '',
      '## Revision requested',
      '',
      p.instruction.trim(),
      '',
      'Return the complete revised lesson plan (not only the changes). Keep everything the teacher didn’t ask to change, keep the required structure, and update the alignment check.',
    ].join('\n')
  } else {
    request = [...sections, '', `Write the ${format.label} now.`].join('\n')
  }

  return {
    title: p.title,
    instructions,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  }
}
