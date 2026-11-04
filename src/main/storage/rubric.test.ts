import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import mammoth from 'mammoth'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkPerformanceTaskSections,
  extractAssessmentCriteria,
  validatePerformanceTaskInputs,
  validateRubricInputs,
} from '@shared/calculation-rules'
import type { TeachingDocument } from '@shared/documents'
import {
  RubricParseError,
  applyRubricReply,
  cellPoints,
  checkRubric,
  criterionMaxPoints,
  defaultHolisticRanges,
  defaultRubric,
  renderRubricMarkdown,
  resizeLevels,
  rubricTotal,
  type RubricData,
} from '@shared/rubric'
import { DEFAULT_TEACHING_DEFAULTS } from '@shared/teaching'
import { renderPromptMarkdown } from '../ai/handoff/prompt'
import { buildDocumentPrompt } from '../ai/prompts/document'
import { rubricToDocx } from '../export/docx'
import { DocumentStore, newDocument } from './document-store'

type Rubric = Extract<TeachingDocument, { kind: 'rubric' }>
type Task = Extract<TeachingDocument, { kind: 'performance-task' }>

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const named = (r: RubricData, names: string[]): RubricData => ({
  ...r,
  criteria: r.criteria.map((c, i) => ({
    ...c,
    name: names[i] ?? c.name,
    descriptors: c.descriptors.map((_, j) => `d${i}${j}`),
  })),
})

describe('analytic rubric maths', () => {
  it('4 criteria × top score 4 = 16 points; cell points = score × weight', () => {
    const r = named(defaultRubric(4, 20, ['A', 'B', 'C', 'D']), ['A', 'B', 'C', 'D'])
    expect(r.levels.map((l) => l.score)).toEqual([4, 3, 2, 1])
    expect(rubricTotal(r)).toBe(16)
    r.criteria[0].weight = 2
    expect(cellPoints(r, r.criteria[0], 1)).toBe(6)
    expect(criterionMaxPoints(r)).toEqual([8, 4, 4, 4])
    expect(rubricTotal(r)).toBe(20)
    expect(checkRubric(r, 4, 20)).toMatchObject({ ok: true, total: 20, errors: [] })
  })

  it('reports a total that misses the target, with the weights needed', () => {
    const r = named(defaultRubric(4, 20, ['A', 'B', 'C', 'D']), [])
    const check = checkRubric(r, 4, 20)
    expect(check.ok).toBe(false)
    expect(check.errors[0]).toBe(
      'The rubric totals 16 points, but the target is 20. With a top score of 4, the weights must add up to 5 (now 4).',
    )
    expect(checkRubric(r, 4, 18).errors[0]).toMatch(/18 is not a multiple of the top score \(4\)/)
    expect(checkRubric(r, 4, null).ok).toBe(true) // no target → any total is fine
  })

  it('requires level scores to go down and weights to be whole numbers ≥ 1', () => {
    const r = named(defaultRubric(4, 20, ['A']), ['A'])
    r.levels[2].score = 3
    r.criteria[0].weight = 0
    const errors = checkRubric(r, 4, null).errors.join(' ')
    expect(errors).toMatch(
      /must go down from left to right: “Proficient” \(3\) must be higher than “Developing” \(3\)/,
    )
    expect(errors).toMatch(/Criterion 1: weight must be a whole number from 1 to 100/)
  })

  it('5-level rubrics use DepEd-style labels and keep text when resized', () => {
    const r = named(defaultRubric(4, 20, ['A', 'B']), ['A', 'B'])
    const five = resizeLevels(r, 5, 25)
    expect(five.levels.map((l) => [l.label, l.score])).toEqual([
      ['Outstanding', 5],
      ['Very Satisfactory', 4],
      ['Satisfactory', 3],
      ['Fairly Satisfactory', 2],
      ['Did Not Meet Expectations', 1],
    ])
    expect(five.criteria[0].descriptors).toEqual(['d00', 'd01', 'd02', 'd03', ''])
    expect(rubricTotal(five)).toBe(10)
  })

  it('total always equals the sum of per-criterion maximums (300 random rubrics)', () => {
    let seed = 7
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed % n
    }
    for (let k = 0; k < 300; k++) {
      const count = rand(2) ? 4 : 5
      const r = defaultRubric(
        count,
        20,
        Array.from({ length: 1 + rand(12) }, (_, i) => `C${i}`),
      )
      r.levels = r.levels.map((l, i) => ({ ...l, score: (count - i) * (1 + rand(3)) }))
      r.levels.sort((a, b) => b.score - a.score)
      r.criteria = r.criteria.map((c) => ({ ...c, weight: 1 + rand(5) }))
      const top = r.levels[0].score
      const expected = sum(r.criteria.map((c) => c.weight * top))
      expect(rubricTotal(r)).toBe(expected)
      expect(sum(criterionMaxPoints(r))).toBe(expected)
      expect(sum(r.criteria.map((c) => cellPoints(r, c, 0)))).toBe(expected)
      expect(renderRubricMarkdown('T', r)).toContain(`**Total score: ${expected} points**`)
    }
  })
})

describe('holistic rubric maths', () => {
  it('default ranges are contiguous, cover 0..total and differ in size by at most 1', () => {
    for (let total = 3; total <= 120; total++) {
      for (const count of [4, 5]) {
        const ranges = defaultHolisticRanges(total, count)
        expect(ranges[0][1]).toBe(total)
        expect(ranges[count - 1][0]).toBe(0)
        for (let i = 1; i < count; i++) expect(ranges[i][1] + 1).toBe(ranges[i - 1][0])
        const sizes = ranges.map(([a, b]) => b - a + 1)
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
        expect(sum(sizes)).toBe(total + 1)
      }
    }
    expect(defaultHolisticRanges(20, 4)).toEqual([
      [15, 20],
      [10, 14],
      [5, 9],
      [0, 4],
    ])
  })

  it('detects overlaps, gaps and a top range that misses the total', () => {
    const r: RubricData = { ...defaultRubric(4, 20), type: 'holistic' }
    r.holistic = r.holistic.map((h) => ({ ...h, description: 'x' }))
    expect(checkRubric(r, 4, 20)).toMatchObject({ ok: true, total: 20 })
    r.holistic[1].maxPoints = 16
    expect(checkRubric(r, 4, 20).errors[0]).toMatch(
      /overlap: “Proficient” ends at 16 but “Excellent” starts at 15/,
    )
    r.holistic[1].maxPoints = 12
    expect(checkRubric(r, 4, 20).errors[0]).toMatch(
      /gap: “Proficient” ends at 12 but “Excellent” starts at 15/,
    )
    r.holistic[1].maxPoints = 14
    expect(checkRubric(r, 4, 25).errors[0]).toMatch(
      /highest range ends at 20 points, but the total score is 25/,
    )
    expect(checkRubric(r, 4, null).errors[0]).toMatch(/Set the total score/)
  })
})

describe('reading an AI reply into a rubric', () => {
  it('reads criteria and descriptors, ignoring point columns and numbers', () => {
    const r = defaultRubric(4, 20, ['Content', '', '', ''])
    r.criteria[0].weight = 2
    const md = [
      'Here is your rubric:',
      '',
      '| Criterion | Excellent | Proficient | Developing | Beginning | Points |',
      '| --- | --- | --- | --- | --- | --- |',
      '| **Content** | Accurate and complete (4 pts) | Mostly accurate | Some errors | Many errors | 8 |',
      '| Organization | Logical \\| clear | Mostly logical | Hard to follow | No order | 4 |',
      '| Total | | | | | 12 |',
    ].join('\n')
    const out = applyRubricReply(md, r)
    expect(out.criteria.map((c) => c.name)).toEqual(['Content', 'Organization'])
    expect(out.criteria[0].weight).toBe(2) // kept from the teacher's rubric
    expect(out.criteria[0].descriptors[0]).toBe('Accurate and complete')
    expect(out.criteria[1].descriptors[0]).toBe('Logical | clear')
    expect(out.levels).toEqual(r.levels) // numbers untouched
  })

  it('reads holistic level descriptions in order', () => {
    const r: RubricData = { ...defaultRubric(4, 20), type: 'holistic' }
    const md =
      '| Level | Description |\n| --- | --- |\n| Excellent | A |\n| Proficient | B |\n| Developing | C |\n| Beginning | D |'
    expect(applyRubricReply(md, r).holistic.map((h) => h.description)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('explains replies it cannot use', () => {
    const r = defaultRubric(4, 20)
    expect(() => applyRubricReply('no table here', r)).toThrow(RubricParseError)
    expect(() =>
      applyRubricReply('| Criterion | A | B |\n| --- | --- | --- |\n| X | 1 | 2 |', r),
    ).toThrow(/2 level columns, but this rubric has 4 levels/)
  })
})

describe('performance tasks', () => {
  const TASK = [
    '# Barangay Recycling Campaign',
    '## Learning Objectives',
    '- Design a poster',
    '## Real-World Scenario',
    '## Student Instructions',
    '### Day 1',
    '## Materials Needed',
    '## Expected Output',
    '## Submission Requirements',
    '## Assessment Criteria',
    '- **Content accuracy** (40%): facts are correct',
    '- **Creativity** (30%): original design',
    '- Teamwork: everyone contributes',
    '## Notes',
    '- Not a criterion',
  ].join('\n')

  it('finds all eight sections, and reports missing ones', () => {
    expect(checkPerformanceTaskSections(TASK)).toEqual([])
    const missing = checkPerformanceTaskSections('# T\n## Learning Objectives\n## Materials Needed')
    expect(missing.map((w) => w.match)).toEqual([
      'Real-World Scenario',
      'Student Instructions',
      'Expected Output',
      'Submission Requirements',
      'Assessment Criteria',
    ])
  })

  it('extracts assessment criteria names for a rubric', () => {
    expect(extractAssessmentCriteria(TASK)).toEqual(['Content accuracy', 'Creativity', 'Teamwork'])
  })

  it('validates the task form', () => {
    const doc = newDocument('performance-task', DEFAULT_TEACHING_DEFAULTS) as Task
    const e = validatePerformanceTaskInputs({ ...doc.inputs, days: 0 })
    expect(e).toMatchObject({
      competency: 'Learning competency is required.',
      topic: 'Lesson topic is required.',
      days: 'Number of days must be a whole number from 1 to 30.',
    })
  })

  it('builds a prompt with the 8 sections, days and resources', () => {
    const doc = newDocument('performance-task', DEFAULT_TEACHING_DEFAULTS) as Task
    doc.inputs = {
      ...doc.inputs,
      competency: 'Use a spreadsheet',
      topic: 'Budgeting',
      days: 2,
      resources: '10 laptops, no internet',
    }
    const p = renderPromptMarkdown(buildDocumentPrompt(doc, 'generate', undefined, 'Philippines'))
    for (const s of [
      '## Learning Objectives',
      '## Real-World Scenario',
      '## Student Instructions',
      '## Materials Needed',
      '## Expected Output',
      '## Submission Requirements',
      '## Assessment Criteria',
    ]) {
      expect(p).toContain(s)
    }
    expect(p).toContain('`### Day 1` … `### Day 2`')
    expect(p).toContain('| Available resources | 10 laptops, no internet |')
    expect(p).toContain('GRASPS')
    expect(p).toContain('The weights must add up to 100%')
  })
})

describe('rubric documents', () => {
  let dir: string
  let store: DocumentStore
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'teachmate-rubric-'))
    store = new DocumentStore(dir)
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  const rubricDoc = () => {
    const doc = newDocument('rubric', DEFAULT_TEACHING_DEFAULTS) as Rubric
    doc.inputs.taskTitle = 'Recycling poster'
    const names = ['Content', 'Design', 'Organization', 'Teamwork']
    doc.rubric = named(defaultRubric(4, 20, names), names)
    doc.inputs.criteriaCount = names.length
    return doc
  }

  it('starts as a 4-level analytic rubric with a 20-point target', () => {
    const doc = rubricDoc()
    const fresh = newDocument('rubric', DEFAULT_TEACHING_DEFAULTS) as Rubric
    expect(fresh.inputs).toMatchObject({ levelCount: 4, targetTotal: 20, criteriaCount: 5 })
    expect(checkRubric(fresh.rubric, 4, 20).ok).toBe(true) // 5 criteria × 4 = 20
    expect(validateRubricInputs(doc.inputs, 'analytic')).toEqual({})
  })

  it('refuses to save when the total misses the target, then saves with rendered content', async () => {
    const doc = rubricDoc()
    await expect(store.save(doc)).rejects.toThrow(/totals 16 points, but the target is 20/)
    doc.rubric.criteria[0].weight = 2
    const saved = (await store.save(doc)) as Rubric
    expect(saved.contentSource).toBe('computed')
    expect(saved.content).toContain('| Content (×2) |')
    expect(saved.content).toContain('**Total score: 20 points**')
  })

  it('builds a rubric prompt that asks for words only, never numbers', () => {
    const doc = rubricDoc()
    const p = renderPromptMarkdown(buildDocumentPrompt(doc, 'generate', undefined, 'Philippines'))
    expect(p).toContain('| Criterion | Excellent | Proficient | Developing | Beginning |')
    expect(p).toContain('Write exactly 4 criteria')
    expect(p).toContain(
      'Use these criteria the teacher already chose, in this order: Content; Design; Organization; Teamwork',
    )
    expect(p).toContain('Do NOT include points, scores, weights or totals anywhere')
  })

  it('exports a Word table with points and the total', async () => {
    const doc = rubricDoc()
    doc.rubric.criteria[0].weight = 2
    const buffer = await rubricToDocx('Poster rubric', 'ICT · Grade 8', doc.rubric, 4, 20)
    const text = (await mammoth.extractRawText({ buffer })).value
    expect(text).toContain('Poster rubric')
    expect(text).toContain('Content')
    expect(text).toContain('Weight ×2 · max 8')
    expect(text).toContain('TOTAL SCORE')
    expect(text).toContain('Total score: ______ / 20 points')
    await expect(rubricToDocx('x', '', rubricDoc().rubric, 4, 20)).rejects.toThrow(
      /calculation errors/,
    )
  })
})
