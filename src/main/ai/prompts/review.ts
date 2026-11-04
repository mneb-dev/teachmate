import type { PreparedPrompt } from '@shared/ai'
import type { Attachment } from '@shared/conversations'
import type { DocumentAction, ReviewInputs } from '@shared/documents'
import {
  ALIGNMENT_GAPS,
  PLAN_TYPE_SECTIONS,
  REVIEW_CRITERIA,
  REVIEW_DEPTHS,
  REVIEW_FOCUSES,
  REVISION_TARGETS,
  type RevisedLessonPlan,
  type ReviewScope,
} from '@shared/review'
import { CURRICULUM_FRAMEWORKS, LESSON_PLAN_FORMATS } from '@shared/teaching'
import { detailsTable, toPromptReference } from './common'

export interface ReviewPromptInput {
  inputs: ReviewInputs
  references: Attachment[]
  country: string
  title: string
  action: DocumentAction
  /** The current review report. */
  currentContent?: string
  instruction?: string
  revisions: RevisedLessonPlan[]
  scope?: ReviewScope
}

/** Fenced block that can't be closed early by backticks inside the text. */
function fenced(text: string, lang = 'text'): string[] {
  const longest = Math.max(3, ...[...text.matchAll(/`{3,}/g)].map((m) => m[0].length))
  const fence = '`'.repeat(longest + 1)
  return [`${fence}${lang}`, text.trim(), fence]
}

const STATUS_RULES = [
  '- **Meets Expectations** — the plan does this well enough to teach as written.',
  '- **Needs Improvement** — it is there but unclear, incomplete, misaligned or unrealistic.',
  '- **Missing** — the plan should contain it and it is absent.',
]

/** The review report structure (labels in English so TeachMate can read them). */
function reportFormat(i: ReviewInputs): string[] {
  const quick = i.depth === 'quick'
  return [
    '## Output format',
    '',
    'Return only Markdown, with no commentary before or after it. Keep the headings and bold labels below in English, exactly as written, so TeachMate can read them; write everything else in the review language.',
    '',
    '````markdown',
    '# Lesson Plan Review: <lesson title as written in the plan>',
    '',
    '<one line: plan type, subject and grade level as stated in the plan; review depth and focus>',
    '',
    '## Overall Evaluation',
    '',
    '**Overall assessment:** <Ready to teach | Ready after minor revisions | Needs major revision> — <one sentence why>',
    '',
    '### Summary of Findings',
    '<' + (quick ? '2–3 sentences' : 'one short paragraph') + '>',
    '',
    '### Key Strengths',
    '- <strength, naming the section it comes from>',
    '',
    '### Major Issues',
    '- <issue, naming the section> (write "- None found." if there are none)',
    '',
    '### Recommended Improvements',
    '- <the most important changes, in priority order>',
    '',
    '## Detailed Evaluation',
    '',
    `### ${REVIEW_CRITERIA[0].letter}. ${REVIEW_CRITERIA[0].label}`,
    '- **Status:** <Meets Expectations | Needs Improvement | Missing>',
    '- **Evidence:** <the section, and a short quotation copied word for word from the plan in “curly quotes”; or "Not found in the lesson plan">',
    '- **Explanation:** <why this status>',
    '- **Recommendation:** <a specific change the teacher can make>',
    '',
    `(repeat for all eight criteria, A to H, with these exact headings: ${REVIEW_CRITERIA.map((c) => `"### ${c.letter}. ${c.label}"`).join(', ')})`,
    '',
    '## Objective and Assessment Alignment',
    '',
    '| Objective (as written) | Competency | Supporting activities | Assessment | Alignment |',
    '| --- | --- | --- | --- | --- |',
    '| <one row per stated objective> | <competency it serves, or "Not stated"> | <activities that develop it, or "None"> | <assessment that measures it, or "None"> | <Aligned / Partly aligned / Not aligned — and why> |',
    '',
    '### Alignment Gaps',
    ...ALIGNMENT_GAPS.map((g) => `- **${g}:** <list them, or "None found">`),
    '',
    '## Improvement Suggestions',
    '',
    '### Critical Improvements',
    '1. <must fix before teaching; write "None." if there are none>',
    '',
    '### Recommended Improvements',
    '1. <should fix>',
    '',
    '### Optional Enhancements',
    '1. <nice to have>',
    '',
    '## Assumptions and Limitations',
    '- <every assumption you made, and what could not be judged from the document>',
    '````',
  ]
}

export function buildReviewPrompt(p: ReviewPromptInput): PreparedPrompt {
  const i = p.inputs
  if (!i.source?.text.trim()) throw new Error('Upload, choose or paste the lesson plan to review.')
  const hasReferences = p.references.length > 0
  const format = LESSON_PLAN_FORMATS[i.planType]
  const focus = REVIEW_FOCUSES[i.focus]
  const quick = i.depth === 'quick'

  const details = detailsTable([
    ['Lesson plan', i.source.title],
    ['Type of lesson plan', format.label],
    ['Subject', i.subject || 'Not specified — read it from the plan'],
    ['Grade level', i.gradeLevel || 'Not specified — read it from the plan'],
    [
      'Curriculum',
      i.curriculum === 'auto'
        ? 'Not specified — judge from the plan and the reference documents'
        : CURRICULUM_FRAMEWORKS[i.curriculum].label,
    ],
    ['Review depth', `${REVIEW_DEPTHS[i.depth].label} — ${REVIEW_DEPTHS[i.depth].description}`],
    ['Review focus', focus.label],
    ['Language of the review', i.language],
  ])

  const criteria = REVIEW_CRITERIA.flatMap((c) => [
    `### ${c.letter}. ${c.label}`,
    ...c.questions.map((q) => `- ${q}`),
    '',
  ])

  const sections = [
    '## Review details',
    '',
    details,
    '',
    '## Review criteria',
    '',
    ...criteria,
    '## Status for each criterion',
    '',
    ...STATUS_RULES,
    '',
    'Do not give numerical scores, points, percentages or ratings unless the teacher’s instructions below explicitly ask for a scoring system.',
    '',
    '## Rules',
    '',
    '- **Base every finding on the lesson plan below.** Name the section it comes from (e.g. “IV. Procedures, C”) and quote short phrases word for word as evidence. Never describe content the plan does not contain.',
    '- **Missing vs. not provided:** mark a criterion **Missing** only when the plan should contain it and it is absent. When something cannot be judged from a lesson plan (e.g. the learners’ actual needs, the class size, or what happened in class), say “not stated in the lesson plan — cannot be judged” in the explanation and list it under Assumptions and Limitations instead of counting it against the plan.',
    `- **Plan type:** this is a ${format.label} (${format.description}). Plans of this type commonly include: ${PLAN_TYPE_SECTIONS[i.planType]} Treat this as a common structure, not an official checklist.`,
    i.formatRequirements.trim()
      ? '- **School formatting requirements** are given below. Check the plan against them and report any section or format the school requires that is missing (under H. Overall Lesson Structure).'
      : '- No school formatting requirements were given; do not demand a specific template.',
    '- **No invented policies or codes:** do not cite DepEd orders, memoranda, policies or standards, and do not write curriculum or competency codes, unless they appear word for word in the lesson plan or the reference documents. If the plan’s codes cannot be checked against a supplied curriculum guide, say they could not be verified.',
    hasReferences
      ? '- **Official references:** reference documents are attached. Use them to check competencies, codes and content standards, and say which reference supports each such finding.'
      : '- **Official references:** no curriculum guide or standard was supplied. Do not say the plan is compliant or non-compliant with any official standard; judge it as an experienced teacher and say the curriculum alignment could not be verified against an official document.',
    '- **Assumptions:** state every assumption clearly under Assumptions and Limitations.',
    `- **Focus:** ${
      i.focus === 'overall'
        ? 'give all eight criteria equal attention.'
        : `give the most detail to ${focus.criteria.map((l) => `criterion ${l}`).join(' and ')}; evaluate the other criteria briefly (status and one sentence each) — but still include all eight.`
    }`,
    quick
      ? '- **Quick review:** keep each Evidence, Explanation and Recommendation to one sentence, and at most three items per list. The alignment table still lists every stated objective.'
      : '- **Comprehensive review:** quote evidence for every criterion, explain each status fully, list every stated objective in the alignment table, and give specific, practical recommendations.',
    '- Be constructive and specific: every issue gets a recommendation the teacher can act on.',
    `- Write the review in ${i.language}.`,
  ]
  if (i.formatRequirements.trim()) {
    sections.push(
      '',
      '## School formatting requirements',
      '',
      ...fenced(i.formatRequirements, 'text'),
    )
  }
  if (i.instructions.trim()) {
    sections.push('', '## Additional instructions from the teacher', '', i.instructions.trim())
  }
  sections.push('', '## The lesson plan (complete text)', '', ...fenced(i.source.text))

  const instructions = [
    `You are an experienced master teacher and instructional supervisor in ${p.country} reviewing a colleague’s lesson plan before it is taught.`,
    'This is a reading and writing task: do not create, edit or run files.',
  ].join('\n')

  const prompt = (request: string): PreparedPrompt => ({
    title: p.title,
    instructions,
    history: [],
    references: p.references.map(toPromptReference),
    request,
  })

  if (p.scope) return prompt(revisionRequest(p, p.scope, sections))

  if (p.action === 'revise') {
    if (!p.instruction?.trim()) throw new Error('Revision instructions are required.')
    if (!p.currentContent?.trim()) throw new Error('There is no review to revise yet.')
    return prompt(
      [
        ...sections,
        '',
        ...reportFormat(i),
        '',
        '## Current review',
        '',
        ...fenced(p.currentContent, 'markdown'),
        '',
        '## Revision requested',
        '',
        p.instruction.trim(),
        '',
        'Return the complete revised review in the same format. Keep everything the teacher didn’t ask to change, and keep every finding based on the lesson plan.',
      ].join('\n'),
    )
  }
  return prompt([...sections, '', ...reportFormat(i), '', 'Write the review now.'].join('\n'))
}

/** A revised lesson plan, written from the plan and the review's findings. */
function revisionRequest(p: ReviewPromptInput, scope: ReviewScope, sections: string[]): string {
  const i = p.inputs
  if (!p.currentContent?.trim()) {
    throw new Error('Review the lesson plan first; the revision uses the review’s findings.')
  }
  const target = REVISION_TARGETS[scope.target]
  if (scope.target === 'sections' && !scope.sections?.trim()) {
    throw new Error('Name the sections to improve.')
  }
  const latest = p.revisions[0]
  if (scope.base === 'revision' && !latest) throw new Error('There is no revised version yet.')
  const base = scope.base === 'revision' && latest ? latest.content : i.source!.text
  const whole = scope.target === 'complete'

  return [
    ...sections,
    '',
    '## Review findings',
    '',
    ...fenced(p.currentContent, 'markdown'),
    ...(scope.base === 'revision'
      ? [
          '',
          '## Current revised version (start from this)',
          '',
          'The teacher already revised the original. Make the change below to this version.',
          '',
          ...fenced(base, 'markdown'),
        ]
      : []),
    '',
    `## Task: ${target.label.toLowerCase()}`,
    '',
    target.task,
    ...(scope.target === 'sections' ? ['', `Sections to improve: ${scope.sections!.trim()}`] : []),
    ...(p.instruction?.trim() ? ['', `The teacher adds: ${p.instruction.trim()}`] : []),
    '',
    '## Rules for the revised plan',
    '',
    `- Keep it a ${LESSON_PLAN_FORMATS[i.planType].label}, with the original section headings and order${i.formatRequirements.trim() ? ' and the school formatting requirements' : ''}.`,
    whole
      ? '- Address every critical and recommended improvement in the review; keep what the review found to work.'
      : '- Change only what the task covers. Copy every other part of the plan word for word. Update another part only where it must change to stay aligned (e.g. an assessment item for a rewritten objective), and say so in the summary of changes.',
    '- Keep the topic, grade level and learning competency. Do not add curriculum codes, DepEd orders, references or materials that are not in the plan or the reference documents.',
    '- Where something only the teacher can supply is missing (e.g. textbook pages, the class schedule), write a placeholder such as “[teacher to supply: textbook pages]” instead of inventing it.',
    '- Keep durations realistic and make them add up to the time allotted in the plan.',
    '',
    '## Output',
    '',
    `Return the complete revised lesson plan in Markdown (all sections, from the title to the end), then a final section "## Summary of Changes" listing each change and the review finding it addresses. Write in ${i.language}. No other commentary.`,
  ].join('\n')
}
