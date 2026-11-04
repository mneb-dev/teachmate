import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { calculationErrors, validateReviewInputs } from '@shared/calculation-rules'
import { documentSubtitle } from '@shared/document-text'
import type { DocumentScope, TeachingDocument } from '@shared/documents'
import {
  addRevision,
  checkReview,
  detectPlanType,
  diffLines,
  parseReview,
  splitRevisionReply,
} from '@shared/review'
import { DEFAULT_TEACHING_DEFAULTS } from '@shared/teaching'
import { renderPromptMarkdown } from '../ai/handoff/prompt'
import { InvalidInputsError, buildDocumentPrompt } from '../ai/prompts/document'
import { DocumentStore, newDocument } from './document-store'
import { validateDocument } from './document-validation'

type Review = Extract<TeachingDocument, { kind: 'lesson-plan-review' }>

const PLAN = `DAILY LESSON LOG
School: Sample High School   Grade Level: Grade 8   Learning Area: ICT

I. OBJECTIVES
A. Content Standards: The learner demonstrates understanding of spreadsheet basics.
C. Learning Competencies/Objectives: At the end of the lesson, learners will understand spreadsheets.
1. Enter data in cells and format it correctly.
2. Appreciate the use of spreadsheets in daily life.

II. CONTENT
Introduction to Spreadsheets

III. LEARNING RESOURCES
Computer, projector

IV. PROCEDURES
A. Reviewing previous lesson (5 minutes)
B. Group activity: learners enter a class budget into a spreadsheet (30 minutes)
J. Evaluation: 5-item quiz on spreadsheet terms (10 minutes)
`

const reviewDoc = (): Review => {
  const doc = newDocument('lesson-plan-review', DEFAULT_TEACHING_DEFAULTS) as Review
  return {
    ...doc,
    inputs: {
      ...doc.inputs,
      source: {
        origin: 'pasted',
        refId: null,
        title: 'Spreadsheets DLL',
        text: PLAN,
        charCount: PLAN.length,
      },
    },
  }
}

const criterion = (letter: string, label: string, status: string, evidence = '') =>
  [
    `### ${letter}. ${label}`,
    `- **Status:** ${status}`,
    `- **Evidence:** ${evidence || 'IV. Procedures'}`,
    '- **Explanation:** Explained.',
    '- **Recommendation:** Do this.',
    '',
  ].join('\n')

const REPORT = [
  '# Lesson Plan Review: Spreadsheets DLL',
  '',
  '## Overall Evaluation',
  '',
  '**Overall assessment:** Ready after minor revisions — mostly sound.',
  '',
  '### Summary of Findings',
  'Fine.',
  '',
  '## Detailed Evaluation',
  '',
  criterion(
    'A',
    'Curriculum and Competency Alignment',
    'Needs Improvement',
    'I. Objectives: “learners will understand spreadsheets”',
  ),
  criterion('B', 'Learning Objectives', 'Needs Improvement'),
  criterion('C', 'Learning Activities', 'Meets Expectations'),
  criterion('D', 'Instructional Strategies', 'Meets Expectations'),
  criterion('E', 'Assessment', 'Needs Improvement'),
  criterion('F', 'Time Allocation', 'Meets Expectations'),
  criterion('G', 'Learning Resources', 'Missing'),
  criterion('H', 'Overall Lesson Structure', 'Meets Expectations'),
  '## Objective and Assessment Alignment',
  '',
  '| Objective (as written) | Competency | Supporting activities | Assessment | Alignment |',
  '| --- | --- | --- | --- | --- |',
  '| Enter data in cells | Spreadsheets | Group activity | None | Partly aligned |',
  '',
  '### Alignment Gaps',
  '- **Objectives without supporting activities:** None found',
  '- **Activities that do not support any objective:** None found.',
  '- **Objectives without corresponding assessment:** Objective 2 (appreciate).',
  '- **Assessment items that do not measure the stated objectives:** The quiz on terms.',
  '',
  '## Improvement Suggestions',
  '',
  '### Critical Improvements',
  '1. Assess objective 1 with a performance check.',
  '   - nested detail',
  '',
  '### Recommended Improvements',
  '1. Rewrite “understand”.',
  '2. List the software.',
  '',
  '### Optional Enhancements',
  '- Add a reflection prompt.',
  '',
  '## Assumptions and Limitations',
  '- Class size not stated.',
].join('\n')

const opts = (instructions = '') => ({
  sourceText: PLAN,
  instructions,
  trustedText: PLAN,
})

describe('reading a review', () => {
  it('reads the overall assessment, statuses, improvements and alignment gaps', () => {
    const r = parseReview(REPORT)
    expect(r.overall).toBe('Ready after minor revisions — mostly sound.')
    expect(r.criteria.map((c) => c.status)).toEqual([
      'needs-improvement',
      'needs-improvement',
      'meets',
      'meets',
      'needs-improvement',
      'meets',
      'missing',
      'meets',
    ])
    expect(r.improvements).toEqual({ critical: 1, recommended: 2, optional: 1 })
    expect(r.gaps.map((g) => g.none)).toEqual([true, true, false, false])
    expect(r.gaps[2].text).toContain('Objective 2')
  })

  it('accepts criteria headings without letters and bold-colon labels', () => {
    const r = parseReview(
      '## Detailed Evaluation\n\n### Learning Objectives\n**Status**: Missing\n\n### Assessment\n**Status:** Excellent',
    )
    expect(r.criteria.find((c) => c.letter === 'B')?.status).toBe('missing')
    const e = r.criteria.find((c) => c.letter === 'E')!
    expect(e.found).toBe(true)
    expect(e.status).toBeNull()
    expect(e.rawStatus).toBe('Excellent')
  })
})

describe('review checks', () => {
  it('passes a complete, grounded review', () => {
    expect(checkReview(REPORT, opts())).toEqual([])
  })

  it('flags missing sections and criteria, and statuses outside the three allowed', () => {
    const short = REPORT.replace(/## Improvement Suggestions[\s\S]*$/, '')
      .replace(/### H\. Overall Lesson Structure[\s\S]*?\n\n/, '')
      .replace('- **Status:** Missing', '- **Status:** Poor')
    const messages = checkReview(short, opts()).map((w) => w.message)
    expect(messages).toContain('The review has no “Improvement Suggestions” section.')
    expect(
      messages.some((m) => m.includes('Criterion H (Overall Lesson Structure) is missing')),
    ).toBe(true)
    expect(messages.some((m) => m.includes('Criterion G has the status “Poor”'))).toBe(true)
  })

  it('flags scores unless a scoring system was asked for', () => {
    const scored = REPORT.replace('mostly sound.', 'mostly sound (8/10).')
    expect(checkReview(scored, opts()).some((w) => w.message.includes('numerical score'))).toBe(
      true,
    )
    expect(checkReview(scored, opts('Please add a score out of 10.'))).toEqual([])
  })

  it('flags compliance claims and DepEd orders not in the plan, but not negated claims', () => {
    const claims = REPORT.replace(
      'Fine.',
      'The plan is fully compliant with DepEd Order No. 99, s. 2024. It does not comply with the school template.',
    )
    const w = checkReview(claims, opts())
    expect(w.filter((x) => x.message.includes('claims compliance'))).toHaveLength(1)
    expect(w.some((x) => x.message.includes('“DepEd Order No. 99, s. 2024” isn’t in'))).toBe(true)
  })

  it('flags evidence quotes that are not in the lesson plan', () => {
    const invented = REPORT.replace(
      '“learners will understand spreadsheets”',
      '“learners will design a complex macro”',
    )
    const w = checkReview(invented, opts())
    expect(w).toHaveLength(1)
    expect(w[0].message).toContain('criterion A isn’t in the lesson plan word for word')
  })
})

describe('plan type and revisions', () => {
  it('detects common plan types', () => {
    expect(detectPlanType(PLAN)).toBe('dll')
    expect(detectPlanType('SEMI-DETAILED LESSON PLAN IN SCIENCE')).toBe('semi-detailed')
    expect(detectPlanType('A Detailed Lesson Plan in English 7')).toBe('dlp')
    expect(detectPlanType('Weekly Home Learning Plan')).toBe('weekly')
    expect(detectPlanType('Lesson\nDay 1: intro\nDay 2: practice')).toBe('multi-day')
    expect(detectPlanType('Lesson on fractions')).toBeNull()
  })

  it('keeps the summary of changes apart from the revised plan', () => {
    const reply =
      '```markdown\n# Revised DLL\n\nI. OBJECTIVES\n\n## Summary of Changes\n- Rewrote objective 1.\n```'
    expect(splitRevisionReply(reply)).toEqual({
      content: '# Revised DLL\n\nI. OBJECTIVES',
      notes: '- Rewrote objective 1.',
    })
    const list = addRevision(
      [],
      reply,
      'pasted',
      { type: 'revision', target: 'objectives', base: 'original' },
      'r1',
    )
    expect(list[0]).toMatchObject({
      id: 'r1',
      target: 'objectives',
      source: 'pasted',
      savedAsId: null,
    })
    expect(() =>
      addRevision(
        [],
        '## Summary of Changes\n',
        'pasted',
        { type: 'revision', target: 'time', base: 'original' },
        'r2',
      ),
    ).toThrow(/no lesson plan/)
    // Newest first, at most five kept.
    let many = list
    for (let k = 2; k <= 7; k++) {
      many = addRevision(
        many,
        `Plan ${k}`,
        'provider',
        { type: 'revision', target: 'complete', base: 'original' },
        `r${k}`,
      )
    }
    expect(many.map((r) => r.id)).toEqual(['r7', 'r6', 'r5', 'r4', 'r3'])
  })

  it('diffs plans ignoring Markdown formatting', () => {
    const diff = diffLines(
      'I. OBJECTIVES\n1. Understand spreadsheets.\nII. CONTENT\nSpreadsheets',
      '## I. OBJECTIVES\n\n1. Enter data in cells.\n\n## II. CONTENT\n\n**Spreadsheets**',
    )!
    expect(diff).toEqual([
      { type: 'same', text: '## I. OBJECTIVES' },
      { type: 'removed', text: '1. Understand spreadsheets.' },
      { type: 'added', text: '1. Enter data in cells.' },
      { type: 'same', text: '## II. CONTENT' },
      { type: 'same', text: '**Spreadsheets**' },
    ])
    expect(diffLines('a\nb\nc', 'x\ny\nz', 4)).toBeNull()
  })
})

describe('review inputs and prompts', () => {
  const render = (
    doc: TeachingDocument,
    scope?: DocumentScope,
    action: 'generate' | 'revise' = 'generate',
    instruction?: string,
  ) => renderPromptMarkdown(buildDocumentPrompt(doc, action, instruction, 'Philippines', scope))

  it('needs a lesson plan with enough text, and never blocks saving', () => {
    const doc = newDocument('lesson-plan-review', DEFAULT_TEACHING_DEFAULTS) as Review
    expect(validateReviewInputs(doc.inputs).source).toMatch(/Upload, choose or paste/)
    const short = {
      ...reviewDoc().inputs,
      source: { ...reviewDoc().inputs.source!, text: 'Too short' },
    }
    expect(validateReviewInputs(short).source).toMatch(/too short/)
    expect(validateReviewInputs(reviewDoc().inputs)).toEqual({})
    expect(calculationErrors(doc)).toEqual([])
    expect(documentSubtitle(reviewDoc())).toContain('Comprehensive review · DLL')
  })

  it('sends the whole plan, the criteria and the grounding rules', () => {
    const p = render(reviewDoc())
    expect(p).toContain('Enter data in cells and format it correctly.')
    expect(p).toContain('J. Evaluation: 5-item quiz')
    for (const h of [
      '### A. Curriculum and Competency Alignment',
      '### H. Overall Lesson Structure',
    ]) {
      expect(p).toContain(h)
    }
    expect(p).toContain(
      'Are cognitive, psychomotor and affective domains addressed where appropriate?',
    )
    expect(p).toContain('Do not give numerical scores')
    expect(p).toContain('mark a criterion **Missing** only when the plan should contain it')
    expect(p).toContain('Do not say the plan is compliant or non-compliant')
    expect(p).toContain('do not cite DepEd orders')
    expect(p).toContain('## Objective and Assessment Alignment')
    expect(p).toContain('**Objectives without corresponding assessment:**')
    expect(p).toContain('### Critical Improvements')
    expect(p).toContain('## Assumptions and Limitations')
    expect(p).toContain('give all eight criteria equal attention')
  })

  it('applies depth, focus and the school format', () => {
    const doc = reviewDoc()
    const p = render({
      ...doc,
      inputs: {
        ...doc.inputs,
        depth: 'quick',
        focus: 'assessment',
        formatRequirements: 'Must include Values Integration.',
        instructions: 'Use a 1–5 scale for each criterion.',
      },
    })
    expect(p).toContain('**Quick review:**')
    expect(p).toContain('give the most detail to criterion E')
    expect(p).toContain('## School formatting requirements')
    expect(p).toContain('Must include Values Integration.')
    expect(p).toContain('Use a 1–5 scale for each criterion.')
  })

  it('builds revision prompts from the review and never for other tools', () => {
    const doc = { ...reviewDoc(), content: REPORT }
    const scope = { type: 'revision', target: 'objectives', base: 'original' } as const
    const p = render(doc, scope, 'generate', 'Keep it short.')
    expect(p).toContain('## Review findings')
    expect(p).toContain('## Task: rewrite the objectives')
    expect(p).toContain('Copy every other part of the plan word for word')
    expect(p).toContain('The teacher adds: Keep it short.')
    expect(p).toContain('"## Summary of Changes"')

    const complete = render(doc, { type: 'revision', target: 'complete', base: 'original' })
    expect(complete).toContain('Address every critical and recommended improvement')

    expect(() => render(reviewDoc(), scope)).toThrow(/Review the lesson plan first/)
    expect(() => render(doc, { type: 'revision', target: 'complete', base: 'revision' })).toThrow(
      /no revised version/,
    )
    const plan = newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS)
    expect(() => buildDocumentPrompt(plan, 'generate', undefined, 'PH', scope)).toThrow(
      InvalidInputsError,
    )
    expect(() =>
      buildDocumentPrompt(doc, 'generate', undefined, 'PH', { type: 'activity', index: 1 }),
    ).toThrow(InvalidInputsError)
  })
})

describe('review storage', () => {
  let dir: string | null = null
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = null
  })

  it('round-trips the source, revisions and revision scopes', async () => {
    dir = await mkdtemp(join(tmpdir(), 'tm-review-'))
    const store = new DocumentStore(dir)
    const doc: Review = {
      ...reviewDoc(),
      content: REPORT,
      revisions: addRevision(
        [],
        '# Revised',
        'pasted',
        { type: 'revision', target: 'time', base: 'original' },
        'rev1',
      ),
      requests: [
        {
          id: 'req1',
          action: 'generate',
          providerId: 'claude-code-handoff',
          createdAt: new Date().toISOString(),
          status: 'awaiting-reply',
          scope: {
            type: 'revision',
            target: 'sections',
            sections: 'IV. Procedures',
            base: 'revision',
          },
        },
      ],
    }
    const saved = await store.save(doc)
    const loaded = (await store.get(saved.id)) as Review
    expect(loaded.inputs).toEqual(doc.inputs)
    expect(loaded.revisions).toEqual(doc.revisions)
    expect(loaded.requests[0].scope).toEqual(doc.requests[0].scope)
    expect((await store.list('lesson-plan-review'))[0].kind).toBe('lesson-plan-review')

    expect(() =>
      validateDocument({
        ...doc,
        requests: [
          { ...doc.requests[0], scope: { type: 'revision', target: 'sections', base: 'original' } },
        ],
      }),
    ).toThrow(/Name the sections/)
    expect(() => validateDocument({ ...doc, inputs: { ...doc.inputs, depth: 'deep' } })).toThrow(
      /depth/,
    )
    expect(() =>
      validateDocument({
        ...doc,
        inputs: {
          ...doc.inputs,
          source: { ...doc.inputs.source, origin: 'document', refId: '../x' },
        },
      }),
    ).toThrow(/refId/)
  })
})
