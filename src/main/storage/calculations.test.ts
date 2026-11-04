import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assessmentColumnCounts,
  assessmentWarnings,
  calculationErrors,
  checkAnswerKey,
  validateAssessmentInputs,
  validateTosInputs,
} from '@shared/calculation-rules'
import type { AssessmentInputs, TeachingDocument } from '@shared/documents'
import { DEFAULT_DISTRIBUTION, DEFAULT_TEACHING_DEFAULTS } from '@shared/teaching'
import {
  apportionMatrix,
  checkTosTable,
  computeTosTable,
  distributionCounts,
  itemPlacement,
  largestRemainder,
  rowPercents,
  type TosInputs,
} from '@shared/tos'
import { DocumentStore, newDocument } from './document-store'

type Assessment = Extract<TeachingDocument, { kind: 'assessment' }>
type Tos = Extract<TeachingDocument, { kind: 'tos' }>

const tosInputs = (overrides: Partial<TosInputs> = {}): TosInputs => ({
  examTitle: 'First Quarterly Examination',
  subject: 'ICT',
  gradeLevel: 'Grade 8',
  quarter: 1,
  totalItems: 50,
  distribution: structuredClone(DEFAULT_DISTRIBUTION),
  competencies: [
    { id: 'c1', competency: 'Identify computer parts', code: '', hours: 6 },
    { id: 'c2', competency: 'Use word processing tools', code: '', hours: 8 },
    { id: 'c3', competency: 'Create a spreadsheet', code: '', hours: 4 },
    { id: 'c4', competency: 'Practice online safety', code: '', hours: 2 },
  ],
  ...overrides,
})

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('largestRemainder', () => {
  it('sums exactly to the total and is proportional', () => {
    expect(largestRemainder(50, [6, 8, 4, 2])).toEqual([15, 20, 10, 5])
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3])
    expect(sum(largestRemainder(7, [0.5, 1.25, 3]))).toBe(7)
  })
  it('handles zero totals and zero weights', () => {
    expect(largestRemainder(0, [1, 2])).toEqual([0, 0])
    expect(largestRemainder(5, [0, 0])).toEqual([0, 0])
  })
})

describe('apportionMatrix', () => {
  it('keeps every row and column total exact for 500 random cases', () => {
    let seed = 42
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed % n
    }
    for (let k = 0; k < 500; k++) {
      const total = 1 + rand(150)
      const rows = largestRemainder(
        total,
        Array.from({ length: 1 + rand(12) }, () => 1 + rand(20)),
      )
      const cols = largestRemainder(
        total,
        Array.from({ length: rand(2) ? 3 : 6 }, () => rand(50)),
      )
      const m = apportionMatrix(rows, cols)
      expect(m.map(sum)).toEqual(rows)
      expect(cols.map((_, j) => sum(m.map((r) => r[j])))).toEqual(cols)
      expect(m.flat().every((v) => Number.isInteger(v) && v >= 0)).toBe(true)
    }
  })
})

describe('TOS calculation and validation', () => {
  it('computes a valid table: items by hours, columns by distribution (60/30/10)', () => {
    const inputs = tosInputs()
    const table = computeTosTable(inputs)
    const check = checkTosTable(inputs, table)
    expect(check.ok).toBe(true)
    expect(check.rowTotals).toEqual([15, 20, 10, 5])
    expect(check.columnTotals).toEqual([30, 15, 5])
    expect(check.grandTotal).toBe(50)
    expect(sum(rowPercents(inputs))).toBeCloseTo(100, 10)
    expect(rowPercents(inputs)).toEqual([30, 40, 20, 10])
  })

  it('supports all six Bloom levels', () => {
    const inputs = tosInputs({
      distribution: { ...structuredClone(DEFAULT_DISTRIBUTION), mode: 'levels' },
    })
    const check = checkTosTable(inputs, computeTosTable(inputs))
    expect(check.ok).toBe(true)
    expect(check.columnTotals).toEqual(distributionCounts(50, inputs.distribution))
    expect(check.columnTotals).toHaveLength(6)
  })

  it('reports row, column and grand-total errors after a bad manual edit', () => {
    const inputs = tosInputs()
    const table = computeTosTable(inputs)
    table.rows[0].cells[0] += 2
    table.edited = true
    const check = checkTosTable(inputs, table)
    expect(check.ok).toBe(false)
    expect(check.rowErrors[0]).toMatch(/Row 1 has 17 items; it needs 15/)
    expect(check.columnErrors[0]).toMatch(
      /Remembering \+ Understanding has 32 items; the distribution needs 30/,
    )
    expect(check.errors[0]).toMatch(/52 items in total; the test needs 50/)
  })

  it('accepts a balanced manual edit (moving an item keeps totals)', () => {
    const inputs = tosInputs()
    const table = computeTosTable(inputs)
    // Swap one item between two rows in two columns: all totals unchanged.
    table.rows[0].cells[0]--
    table.rows[0].cells[1]++
    table.rows[1].cells[0]++
    table.rows[1].cells[1]--
    expect(checkTosTable(inputs, { ...table, edited: true }).ok).toBe(true)
  })

  it('detects a table that no longer matches the inputs', () => {
    const inputs = tosInputs()
    const table = computeTosTable(inputs)
    const more = tosInputs({
      competencies: [...inputs.competencies, { id: 'c5', competency: 'X', code: '', hours: 1 }],
    })
    expect(checkTosTable(more, table).errors[0]).toMatch(/no longer matches/)
  })

  it('numbers items column by column without gaps', () => {
    const inputs = tosInputs({ totalItems: 10 })
    const placement = itemPlacement(computeTosTable(inputs))
    const numbers = placement
      .flat()
      .filter(Boolean)
      .flatMap((r) => {
        const [a, b] = r.split('–').map(Number)
        return Array.from({ length: (b ?? a) - a + 1 }, (_, k) => a + k)
      })
      .sort((a, b) => a - b)
    expect(numbers).toEqual(Array.from({ length: 10 }, (_, k) => k + 1))
  })

  it('validates inputs: distribution must total 100, hours positive', () => {
    const bad = tosInputs({
      distribution: {
        ...structuredClone(DEFAULT_DISTRIBUTION),
        groups: { 'remember-understand': 60, 'apply-analyze': 30, 'evaluate-create': 5 },
      },
      competencies: [{ id: 'c1', competency: '', code: '', hours: 0 }],
    })
    const e = validateTosInputs(bad)
    expect(e.distribution).toMatch(/add up to 100% \(currently 95%\)/)
    expect(e.competencies).toMatch(/Fix 1 competency/)
  })

  it('warns when a competency gets no items', () => {
    const inputs = tosInputs({
      totalItems: 5,
      competencies: [
        { id: 'a', competency: 'Big', code: '', hours: 40 },
        { id: 'b', competency: 'Tiny', code: '', hours: 1 },
      ],
    })
    expect(checkTosTable(inputs, computeTosTable(inputs)).warnings[0]).toMatch(
      /“Tiny” gets no items/,
    )
  })
})

describe('assessment validation', () => {
  const base = (): AssessmentInputs => {
    const doc = newDocument('assessment', DEFAULT_TEACHING_DEFAULTS) as Assessment
    return { ...doc.inputs, topic: 'Computer parts' }
  }

  it('accepts the defaults (20 items: 10 MC + 5 T/F + 5 identification; 60/30/10)', () => {
    expect(validateAssessmentInputs(base())).toEqual({})
    expect(assessmentColumnCounts(base())).toEqual([12, 6, 2])
  })

  it('requires question-type counts to add up to the number of questions', () => {
    expect(validateAssessmentInputs({ ...base(), itemCount: 25 }).questionTypes).toMatch(
      /add up to 20 items; the test has 25/,
    )
  })

  it('requires the Bloom percentages to total 100', () => {
    const i = base()
    i.distribution.groups['evaluate-create'] = 20
    expect(validateAssessmentInputs(i).distribution).toMatch(/currently 110%/)
  })

  it('warns when question types cannot reach the requested Bloom levels', () => {
    const i: AssessmentInputs = {
      ...base(),
      questionTypes: [{ type: 'true-false', count: 20 }],
    }
    expect(assessmentWarnings(i)[0]).toMatch(/2 items target Evaluating or higher, but only 0/)
    expect(
      assessmentWarnings({
        ...i,
        questionTypes: [
          { type: 'multiple-choice', count: 18 },
          { type: 'essay', count: 2 },
        ],
      }),
    ).toEqual([])
  })

  it('uses the TOS allocation when attached', () => {
    const i: AssessmentInputs = {
      ...base(),
      itemCount: 6,
      questionTypes: [{ type: 'multiple-choice', count: 6 }],
      tos: {
        sourceId: 'tos1',
        title: 'TOS',
        mode: 'grouped',
        rows: [{ competency: 'A', code: '', cells: [3, 2, 1] }],
      },
    }
    expect(validateAssessmentInputs(i)).toEqual({})
    expect(assessmentColumnCounts(i)).toEqual([3, 2, 1])
    expect(
      validateAssessmentInputs({
        ...i,
        itemCount: 7,
        questionTypes: [{ type: 'multiple-choice', count: 7 }],
      }).itemCount,
    ).toMatch(/TOS has 6 items/)
  })
})

describe('answer key check', () => {
  it('passes when items 1..N appear once (table or list)', () => {
    const table =
      '# Quiz\n\n## Answer Key\n\n| Item | Answer |\n| --- | --- |\n| 1 | B |\n| 2 | True |\n| 3 | CPU |'
    expect(checkAnswerKey(table, 3)).toEqual([])
    expect(
      checkAnswerKey('## Answer key\n1. A\n2. B\n3) C\n\n## Scoring Guide\n4. not counted', 3),
    ).toEqual([])
  })
  it('reports missing, extra and duplicate items', () => {
    const md = '## Answer Key\n| Item | Answer |\n| --- | --- |\n| 1 | A |\n| 1 | B |\n| 4 | C |'
    const messages = checkAnswerKey(md, 3).map((w) => w.message)
    expect(messages[0]).toMatch(/missing items 2, 3/)
    expect(messages[1]).toMatch(/item number 4, beyond the 3 items/)
    expect(messages[2]).toMatch(/lists item 1 more than once/)
  })
  it('reports a missing answer key section', () => {
    expect(checkAnswerKey('# Quiz\n1. Question?', 1)[0].message).toMatch(/No “Answer Key” section/)
  })
})

describe('saving enforces calculations', () => {
  let dir: string
  let store: DocumentStore
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'teachmate-calc-'))
    store = new DocumentStore(dir)
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  it('refuses an assessment whose question types don’t add up', async () => {
    const doc = newDocument('assessment', DEFAULT_TEACHING_DEFAULTS) as Assessment
    doc.inputs.itemCount = 30
    await expect(store.save(doc)).rejects.toThrow(
      /Fix the calculations before saving: Question types add up to 20/,
    )
  })

  it('refuses a TOS with wrong totals, and saves a valid one with rendered content', async () => {
    const doc = newDocument('tos', DEFAULT_TEACHING_DEFAULTS) as Tos
    doc.inputs = tosInputs()
    doc.table = computeTosTable(doc.inputs)
    doc.table.rows[2].cells[2] += 1
    doc.table.edited = true
    await expect(store.save(doc)).rejects.toThrow(/Row 3 has 11 items; it needs 10/)

    doc.table = computeTosTable(doc.inputs)
    const saved = (await store.save(doc)) as Tos
    expect(saved.contentSource).toBe('computed')
    expect(saved.content).toContain('| 2 | Use word processing tools | 8 | 40.00 | 20 |')
    expect(saved.content).toContain(
      '| | **Total** | **20** | **100.00** | **50** | **30** | **15** | **5** |',
    )
    expect(calculationErrors(saved)).toEqual([])
  })

  it('recalculates a TOS table whose rows no longer match its competencies', async () => {
    const doc = newDocument('tos', DEFAULT_TEACHING_DEFAULTS) as Tos
    doc.inputs = tosInputs()
    doc.table = null
    const saved = (await store.save(doc)) as Tos
    expect(saved.table?.rows).toHaveLength(4)
  })
})
