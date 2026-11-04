import { describe, expect, it } from 'vitest'
import type { TeachingDocument } from '@shared/documents'
import { DEFAULT_TEACHING_DEFAULTS } from '@shared/teaching'
import { newDocument } from '../../storage/document-store'
import { renderPromptMarkdown } from '../handoff/prompt'
import { buildDocumentPrompt } from './document'

function lessonPlan(
  overrides: Partial<Extract<TeachingDocument, { kind: 'lesson-plan' }>['inputs']> = {},
) {
  const doc = newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS)
  if (doc.kind !== 'lesson-plan') throw new Error('unexpected kind')
  doc.inputs = {
    ...doc.inputs,
    topic: 'Introduction to Spreadsheets',
    competency: 'Use spreadsheet formulas to compute class grades',
    ...overrides,
  }
  return doc
}

function objectives() {
  const doc = newDocument('learning-objectives', DEFAULT_TEACHING_DEFAULTS)
  if (doc.kind !== 'learning-objectives') throw new Error('unexpected kind')
  doc.inputs = { ...doc.inputs, topic: 'Computer Hardware', bloomLevels: ['applying', 'creating'] }
  return doc
}

const render = (
  doc: TeachingDocument,
  action: 'generate' | 'revise' = 'generate',
  instruction?: string,
) => renderPromptMarkdown(buildDocumentPrompt(doc, action, instruction, 'Philippines'))

describe('lesson plan prompt', () => {
  it('uses the teaching defaults (Grade 8, ICT, 60 minutes, English, Philippines)', () => {
    const p = render(lessonPlan())
    expect(p).toContain('| Grade level | Grade 8 |')
    expect(p).toContain('| Subject | Computer Education / ICT |')
    expect(p).toContain('60 minutes per session')
    expect(p).toContain('Write in English.')
    expect(p).toContain('Context: Philippines.')
  })

  it('forbids inventing curriculum codes when none is supplied', () => {
    const p = render(lessonPlan())
    expect(p).toContain(
      'Do NOT invent, guess or reconstruct official DepEd curriculum or competency codes',
    )
    expect(p).toContain('Code: not provided')
  })

  it('uses the teacher’s code exactly when supplied', () => {
    const p = render(lessonPlan({ competencyCode: 'TLE_ICTCS8-Ia-1' }))
    expect(p).toContain('The teacher supplied the competency code "TLE_ICTCS8-Ia-1"')
    expect(p).not.toContain('Do NOT invent, guess')
  })

  it('requires alignment and an alignment check table', () => {
    const p = render(lessonPlan())
    expect(p).toContain('**Alignment is mandatory:**')
    expect(p).toContain('## Alignment check')
    expect(p).toContain('Objective | Bloom’s level / domain | Learning activities | Assessment')
  })

  it.each([
    ['dll', 'Daily Lesson Log (DLL)', 'IV. PROCEDURES'],
    ['dlp', 'Detailed Lesson Plan (DLP)', 'Teacher’s Activity | Learners’ Expected Response'],
    ['semi-detailed', 'Semi-Detailed Lesson Plan', 'without scripted dialogue'],
    ['multi-day', 'Multi-Day Lesson Plan', '"Day 1" … "Day 3"'],
    ['weekly', 'Weekly Lesson Plan', 'Day | Objectives | Key learning activities'],
  ] as const)('%s format has its own structure', (format, label, marker) => {
    const sessions = format === 'multi-day' ? 3 : 1
    const p = render(lessonPlan({ format, sessions }))
    expect(p).toContain(label)
    expect(p).toContain(marker)
  })

  it('uses MATATAG phases when MATATAG is selected', () => {
    const p = render(lessonPlan({ curriculum: 'matatag' }))
    expect(p).toContain('Activating Prior Knowledge')
    expect(p).not.toContain('A. Reviewing previous lesson')
  })

  const ilawRef = {
    id: 'r-ilaw',
    name: 'ILAW-guide.pdf',
    kind: 'pdf' as const,
    size: 10,
    text: 'ILAW PHASES',
    charCount: 11,
    truncated: false,
  }

  it('follows the ILAW phases from the references when ILAW is selected', () => {
    const doc = lessonPlan({ curriculum: 'ilaw' })
    doc.references = [ilawRef]
    const p = render(doc)
    expect(p).toContain('| Curriculum | ILAW |')
    expect(p).toContain('Follow the ILAW curriculum and its lesson structure')
    expect(p).toContain('Follow the ILAW lesson phases from the reference documents')
    expect(p).not.toContain('A. Reviewing previous lesson')
  })

  it('falls back to K-12 steps for ILAW without references, and says so', () => {
    const p = render(lessonPlan({ curriculum: 'ilaw' }))
    expect(p).toContain('No ILAW reference document was supplied')
    expect(p).toContain('A. Reviewing previous lesson')
  })

  it('in auto mode with references, considers ILAW, MATATAG and K-12', () => {
    const doc = lessonPlan()
    doc.references = [ilawRef]
    const p = render(doc)
    expect(p).toContain('the ILAW curriculum, the MATATAG curriculum or the K-12 curriculum')
    expect(p).toContain('If you follow ILAW, use the ILAW phases from the reference documents')
  })

  it('in auto mode without references, defaults to K-12 and says so', () => {
    expect(render(lessonPlan())).toContain(
      'No reference documents were supplied, so use the DepEd K-12 format',
    )
  })

  it('includes reference documents and bases content on them', () => {
    const doc = lessonPlan()
    doc.references = [
      {
        id: 'r1',
        name: 'MELC.pdf',
        kind: 'pdf',
        size: 10,
        text: 'REFERENCE TEXT',
        charCount: 14,
        truncated: false,
      },
    ]
    const p = render(doc)
    expect(p).toContain('### MELC.pdf')
    expect(p).toContain('REFERENCE TEXT')
    expect(p).toContain('Base the content on the reference documents')
  })

  it('builds revision prompts with the current content and the instruction', () => {
    const doc = lessonPlan()
    doc.content = '# Existing plan\n\nBody'
    const p = render(doc, 'revise', 'Add a group activity')
    expect(p).toContain('## Current lesson plan')
    expect(p).toContain('# Existing plan')
    expect(p).toContain('## Revision requested\n\nAdd a group activity')
    expect(p).toContain('Return the complete revised lesson plan')
  })

  it('refuses incomplete forms with readable errors', () => {
    expect(() => render(lessonPlan({ topic: '', competency: '' }))).toThrow(
      /Topic is required\. Learning competency is required\./,
    )
    expect(() => render(lessonPlan({ format: 'multi-day', sessions: 1 }))).toThrow(
      /Number of sessions for a Multi-Day must be a whole number from 2 to 10/,
    )
  })

  it('refuses a revision without content or instructions', () => {
    expect(() => render(lessonPlan(), 'revise', 'x')).toThrow(/no lesson plan to revise/)
  })
})

describe('learning objectives prompt', () => {
  it('lists only the selected Bloom levels with measurable verbs, and the selected domains', () => {
    const p = render(objectives())
    expect(p).toContain('**Applying**')
    expect(p).toContain('**Creating**')
    expect(p).not.toContain('**Remembering**')
    expect(p).toContain('**Psychomotor**')
    expect(p).toContain('**Affective**')
    expect(p).toContain('Never use non-measurable verbs as the main verb: understand, know, learn')
  })

  it('asks for a table with assessment evidence (alignment)', () => {
    const p = render(objectives())
    expect(p).toContain('# | Objective | Bloom’s level | Domain | Assessment evidence')
    expect(p).toContain('**Alignment:**')
  })

  it('requires at least one Bloom level and domain', () => {
    const doc = objectives()
    if (doc.kind !== 'learning-objectives') return
    doc.inputs.bloomLevels = []
    doc.inputs.domains = []
    expect(() => render(doc)).toThrow(/at least one Bloom’s level.*at least one learning domain/)
  })
})

describe('assessment prompt', () => {
  function assessment() {
    const doc = newDocument('assessment', DEFAULT_TEACHING_DEFAULTS)
    if (doc.kind !== 'assessment') throw new Error('unexpected kind')
    doc.inputs = { ...doc.inputs, topic: 'Computer parts', includeExplanations: true }
    return doc
  }

  it('lists test parts with continuous item numbers', () => {
    const p = render(assessment())
    expect(p).toContain('| Test I | Multiple choice | 10 | 1–10 |')
    expect(p).toContain('| Test II | True or False | 5 | 11–15 |')
    expect(p).toContain('| Test III | Identification | 5 | 16–20 |')
  })

  it('includes the Bloom distribution with exact item counts', () => {
    const p = render(assessment())
    expect(p).toContain('| Remembering + Understanding | 60% | 12 |')
    expect(p).toContain('| Applying + Analyzing | 30% | 6 |')
    expect(p).toContain('| Evaluating + Creating | 10% | 2 |')
  })

  it('asks for an answer key with explanations and per-type rules', () => {
    const p = render(assessment())
    expect(p).toContain(
      '"## Answer Key": a table with the columns Item | Answer | Bloom’s level | Explanation',
    )
    expect(p).toContain('Four options labelled A–D with exactly one correct answer')
    expect(p).toContain(
      'Do NOT invent, guess or reconstruct official DepEd curriculum or competency codes',
    )
  })

  it('uses the TOS allocation when one is attached', () => {
    const doc = assessment()
    if (doc.kind !== 'assessment') return
    doc.inputs.itemCount = 6
    doc.inputs.questionTypes = [{ type: 'multiple-choice', count: 6 }]
    doc.inputs.tos = {
      sourceId: 'tos1',
      title: 'Q1 TOS',
      mode: 'grouped',
      rows: [{ competency: 'Identify parts', code: 'ICT8-Ia-1', cells: [3, 2, 1] }],
    }
    const p = render(doc)
    expect(p).toContain('## Table of specifications: Q1 TOS')
    expect(p).toContain('| Identify parts (ICT8-Ia-1) | 3 | 2 | 1 | 6 |')
  })

  it('refuses a TOS document (it is calculated, not generated)', () => {
    const tos = newDocument('tos', DEFAULT_TEACHING_DEFAULTS)
    expect(() => render(tos)).toThrow(/calculated in TeachMate/)
  })
})
