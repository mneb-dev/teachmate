import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { DEFAULT_DISTRIBUTION } from '@shared/teaching'
import { computeTosTable, type TosInputs } from '@shared/tos'
import { markdownToDocx, tosToDocx } from './docx'

const text = async (buffer: Buffer) => (await mammoth.extractRawText({ buffer })).value

const ASSESSMENT = [
  '# Quiz: Computer Parts',
  '',
  'General directions: read carefully.',
  '',
  '## Test I. Multiple Choice',
  '',
  '1. Which part is the **brain** of the computer?',
  '   - A. Monitor',
  '   - B. CPU',
  '',
  '## Answer Key',
  '',
  '| Item | Answer | Bloom’s level |',
  '| --- | --- | --- |',
  '| 1 | B | Remembering |',
  '',
  '## Bloom’s Taxonomy Summary',
  '',
  'Remembering: 1',
].join('\n')

describe('markdownToDocx', () => {
  it('produces a Word file with headings, lists, bold text and tables', async () => {
    const buffer = await markdownToDocx(ASSESSMENT)
    expect(buffer.subarray(0, 2).toString()).toBe('PK') // .docx is a zip
    const t = await text(buffer)
    expect(t).toContain('Quiz: Computer Parts')
    expect(t).toContain('Which part is the brain of the computer?')
    expect(t).toContain('B. CPU')
    expect(t).toContain('Answer Key')
    expect(t).toContain('Remembering')
  })

  it('learner copy removes the answer key and summary and adds a name line', async () => {
    const t = await text(await markdownToDocx(ASSESSMENT, 'student'))
    expect(t).toContain('Which part is the brain of the computer?')
    expect(t).not.toContain('Answer Key')
    expect(t).not.toContain('Bloom’s Taxonomy Summary')
    expect(t).toMatch(/Name: _+/)
  })
})

describe('tosToDocx', () => {
  const inputs: TosInputs = {
    examTitle: 'First Quarterly Examination',
    subject: 'ICT',
    gradeLevel: 'Grade 8',
    quarter: 1,
    totalItems: 20,
    distribution: structuredClone(DEFAULT_DISTRIBUTION),
    competencies: [
      { id: 'a', competency: 'Identify computer parts', code: 'ICT8-Ia-1', hours: 3 },
      { id: 'b', competency: 'Use a word processor', code: '', hours: 1 },
    ],
  }

  it('exports the TOS table with totals', async () => {
    const t = await text(await tosToDocx('TOS', inputs, computeTosTable(inputs)))
    expect(t).toContain('TABLE OF SPECIFICATIONS')
    expect(t).toContain('First Quarterly Examination')
    expect(t).toContain('Identify computer parts (ICT8-Ia-1)')
    expect(t).toContain('TOTAL')
    expect(t).toContain('Prepared by')
  })

  it('refuses to export a TOS with wrong totals', async () => {
    const table = computeTosTable(inputs)
    table.rows[0].cells[0] += 1
    await expect(tosToDocx('TOS', inputs, table)).rejects.toThrow(/calculation errors/)
  })
})
