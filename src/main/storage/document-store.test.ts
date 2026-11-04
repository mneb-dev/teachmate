import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOCUMENT_LIMITS } from '@shared/documents'
import {
  findNonMeasurableVerbs,
  findUnverifiedCodes,
  validateLessonPlanInputs,
} from '@shared/document-rules'
import { DEFAULT_TEACHING_DEFAULTS } from '@shared/teaching'
import { DocumentStore, newDocument, replaceContent } from './document-store'
import { parseTeachingDefaults } from './settings-store'

let dir: string
let store: DocumentStore

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'teachmate-docs-'))
  store = new DocumentStore(dir)
})
afterEach(async () => rm(dir, { recursive: true, force: true }))

describe('DocumentStore', () => {
  it('creates documents from the teaching defaults', () => {
    const doc = newDocument('lesson-plan', { ...DEFAULT_TEACHING_DEFAULTS, gradeLevel: 'Grade 10' })
    expect(doc.inputs).toMatchObject({
      gradeLevel: 'Grade 10',
      subject: 'Computer Education / ICT',
      durationMinutes: 60,
      language: 'English',
    })
    expect(doc.title).toBe('DLL — Grade 10 Computer Education / ICT')
  })

  it('saves, lists by kind, reloads and deletes', async () => {
    const plan = await store.save(newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS))
    const objectives = await store.save(
      newDocument('learning-objectives', DEFAULT_TEACHING_DEFAULTS),
    )
    expect(await readdir(dir)).toHaveLength(2)
    expect((await store.list('lesson-plan')).map((d) => d.id)).toEqual([plan.id])
    expect((await store.list()).map((d) => d.id).sort()).toEqual([plan.id, objectives.id].sort())
    expect((await store.get(plan.id))?.kind).toBe('lesson-plan')
    await store.delete(plan.id)
    expect(await store.get(plan.id)).toBeNull()
  })

  it('fills an empty title with a suggested one', async () => {
    const doc = newDocument('learning-objectives', DEFAULT_TEACHING_DEFAULTS)
    doc.title = ''
    if (doc.kind === 'learning-objectives') doc.inputs.topic = 'Networks'
    expect((await store.save(doc)).title).toBe(
      'Objectives — Grade 8 Computer Education / ICT: Networks',
    )
  })

  it('allows incomplete drafts but rejects malformed data', async () => {
    const doc = newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS)
    await expect(store.save(doc)).resolves.toBeTruthy() // topic/competency empty = draft
    await expect(
      store.save({ ...doc, inputs: { ...doc.inputs, format: 'essay' } }),
    ).rejects.toThrow(/format/)
    await expect(store.save({ ...doc, kind: 'poem' })).rejects.toThrow(/kind/)
    await expect(store.get('../x')).rejects.toThrow(/Invalid/)
  })

  it('keeps previous content as versions, newest first, capped', () => {
    let doc = newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS)
    for (let n = 1; n <= DOCUMENT_LIMITS.versionsKept + 3; n++)
      doc = replaceContent(doc, `v${n}`, 'pasted')
    expect(doc.content).toBe(`v${DOCUMENT_LIMITS.versionsKept + 3}`)
    expect(doc.versions).toHaveLength(DOCUMENT_LIMITS.versionsKept)
    expect(doc.versions[0].content).toBe(`v${DOCUMENT_LIMITS.versionsKept + 2}`)
  })
})

describe('form validation', () => {
  const valid = () => {
    const d = newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS)
    if (d.kind !== 'lesson-plan') throw new Error()
    return { ...d.inputs, topic: 'Spreadsheets', competency: 'Use formulas' }
  }
  it('accepts a complete form', () => expect(validateLessonPlanInputs(valid())).toEqual({}))
  it('checks ranges and per-format session limits', () => {
    expect(
      validateLessonPlanInputs({ ...valid(), quarter: 5, week: 0, durationMinutes: 5 }),
    ).toMatchObject({
      quarter: expect.stringMatching(/1 to 4/),
      week: expect.stringMatching(/1 to 12/),
      durationMinutes: expect.stringMatching(/10 to 300/),
    })
    expect(validateLessonPlanInputs({ ...valid(), format: 'dll', sessions: 6 }).sessions).toMatch(
      /1 to 5/,
    )
  })
  it('only accepts code-like characters in the teacher-supplied code', () => {
    expect(validateLessonPlanInputs({ ...valid(), competencyCode: 'TLE_ICTCS7/8-0a-b-1' })).toEqual(
      {},
    )
    expect(
      validateLessonPlanInputs({ ...valid(), competencyCode: '<script>' }).competencyCode,
    ).toBeTruthy()
  })
})

describe('content checks', () => {
  it('flags curriculum codes that are not in the teacher’s inputs or references', () => {
    const content = 'Competency: TLE_ICTCS8-Ia-1 and also S8FE-Ia-15 and M8AL-IIa-b-1.'
    const warnings = findUnverifiedCodes(content, ['Code given: TLE_ICTCS8-Ia-1'])
    expect(warnings.map((w) => w.match)).toEqual(['S8FE-Ia-15', 'M8AL-IIa-b-1'])
  })

  it('ignores ordinary text', () => {
    expect(findUnverifiedCodes('Grade 8 - Week 1 - Day 2, Q1-W3', [])).toEqual([])
  })

  it('flags non-measurable verbs in objective lines only', () => {
    const content = [
      'Learners will understand this paragraph text.', // prose, ignored
      '1. Learners will be able to understand spreadsheets',
      '| 2 | Students will identify cells | Remembering |',
      '- learners will appreciate teamwork',
    ].join('\n')
    expect(findNonMeasurableVerbs(content).map((w) => w.match)).toEqual([
      'understand',
      'appreciate',
    ])
  })
})

describe('teaching defaults', () => {
  it('validates strictly from the renderer', () => {
    expect(() =>
      parseTeachingDefaults({ ...DEFAULT_TEACHING_DEFAULTS, durationMinutes: 500 }),
    ).toThrow(/10 to 300/)
    expect(() =>
      parseTeachingDefaults({ ...DEFAULT_TEACHING_DEFAULTS, gradeLevel: 'Grade 99' }),
    ).toThrow(/grade/)
    expect(
      parseTeachingDefaults({ ...DEFAULT_TEACHING_DEFAULTS, language: 'Filipino' }).language,
    ).toBe('Filipino')
  })
  it('falls back per field when reading a damaged settings file', () => {
    expect(parseTeachingDefaults({ subject: 'Science', durationMinutes: 'x' }, true)).toEqual({
      ...DEFAULT_TEACHING_DEFAULTS,
      subject: 'Science',
    })
  })
})

describe('ILAW curriculum', () => {
  it('round-trips through document validation', async () => {
    const { validateDocument } = await import('./document-validation')
    const doc = newDocument('lesson-plan', { ...DEFAULT_TEACHING_DEFAULTS, curriculum: 'ilaw' })
    if (doc.kind !== 'lesson-plan') throw new Error('unexpected kind')
    expect(doc.inputs.curriculum).toBe('ilaw')
    const parsed = validateDocument(JSON.parse(JSON.stringify(doc)))
    if (parsed.kind !== 'lesson-plan') throw new Error('unexpected kind')
    expect(parsed.inputs.curriculum).toBe('ilaw')
  })
})
