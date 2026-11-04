import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Document, HeadingLevel, Packer, Paragraph } from 'docx'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkAnnotation, joinParagraphs, splitParagraphs, wordCount } from '@shared/annotation'
import { validateAnnotationInputs } from '@shared/calculation-rules'
import type { TeachingDocument } from '@shared/documents'
import { DEFAULT_TEACHING_DEFAULTS } from '@shared/teaching'
import { fileToMarkdown } from '../attachments/to-markdown'
import { renderPromptMarkdown } from '../ai/handoff/prompt'
import { buildDocumentPrompt } from '../ai/prompts/document'
import { documentToMarkdown } from '../export/markdown'
import { DocumentStore, newDocument } from './document-store'
import { ResourceStore } from './resource-store'

type Annotation = Extract<TeachingDocument, { kind: 'annotation' }>

let dir: string
let files: string
let store: ResourceStore
const defaults = { subject: 'ICT', gradeLevel: 'Grade 8' }

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'teachmate-lib-'))
  files = await mkdtemp(join(tmpdir(), 'teachmate-files-'))
  store = new ResourceStore(join(dir, 'resources'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
  await rm(files, { recursive: true, force: true })
})

async function fixture(name: string, content: string | Buffer) {
  const path = join(files, name)
  await writeFile(path, content)
  return path
}

async function docxFixture(name: string) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: 'Daily Lesson Log', heading: HeadingLevel.HEADING_1 }),
          new Paragraph('Objectives: learners identify 3 types of waste.'),
        ],
      },
    ],
  })
  return fixture(name, await Packer.toBuffer(doc))
}

describe('ResourceStore', () => {
  it('preserves the original byte for byte and extracts its text', async () => {
    const src = await fixture('Week_3 notes.txt', 'Line one\r\nLine two — ñ')
    const out = await store.importFile(src, defaults)
    if (out.status !== 'imported') throw new Error('expected import')
    const r = out.resource
    expect(r).toMatchObject({
      title: 'Week 3 notes',
      originalName: 'Week_3 notes.txt',
      kind: 'txt',
      subject: 'ICT',
      gradeLevel: 'Grade 8',
      tags: [],
    })
    expect(await readFile(store.originalPath(r))).toEqual(await readFile(src))
    expect((await store.get(r.id)).text).toBe('Line one\nLine two — ñ')
    expect(await readdir(join(dir, 'resources', r.id))).toEqual([
      'extracted.txt',
      'original.txt',
      'resource.json',
    ])
  })

  it('detects duplicates by content and only adds them when allowed, in a new folder', async () => {
    const a = await fixture('a.md', '# Same')
    const b = await fixture('b.md', '# Same')
    const first = await store.importFile(a, defaults)
    const second = await store.importFile(b, defaults)
    expect(second.status).toBe('duplicate')
    if (second.status === 'duplicate' && first.status === 'imported') {
      expect(second.existing.id).toBe(first.resource.id)
    }
    const forced = await store.importFile(b, defaults, { allowDuplicate: true })
    expect(forced.status).toBe('imported')
    expect((await store.all()).length).toBe(2)
  })

  it('imports Word files and converts them to Markdown for documents', async () => {
    const src = await docxFixture('dll.docx')
    const out = await store.importFile(src, defaults)
    if (out.status !== 'imported') throw new Error('expected import')
    expect((await store.get(out.resource.id)).text).toContain('learners identify 3 types of waste')
    const md = await fileToMarkdown(store.originalPath(out.resource), 'docx')
    expect(md).toMatch(/Daily Lesson Log/)
    expect(md).toContain('Objectives: learners identify 3 types of waste.')
  })

  it('rejects unsupported and empty files without leaving folders behind', async () => {
    await expect(store.importFile(await fixture('x.exe', 'MZ'), defaults)).rejects.toThrow(
      /Unsupported/,
    )
    await expect(store.importFile(await fixture('empty.txt', ''), defaults)).rejects.toThrow(
      /no text/,
    )
    expect(await store.all()).toEqual([])
  })

  it('updates metadata with tidy tags and validation', async () => {
    const out = await store.importFile(await fixture('n.txt', 'x'), defaults)
    if (out.status !== 'imported') throw new Error()
    const r = await store.update(out.resource.id, {
      title: '  Waste   lesson ',
      subject: 'Science',
      gradeLevel: 'Grade 7',
      tags: [' recycling ', 'Recycling', '', 'environment'],
      description: 'Notes',
    })
    expect(r).toMatchObject({
      title: 'Waste lesson',
      subject: 'Science',
      tags: ['recycling', 'environment'],
    })
    await expect(store.update(r.id, { ...r, title: ' ' })).rejects.toThrow(/Title is required/)
  })

  it('searches metadata and extracted text, and filters by subject, grade and tag', async () => {
    const a = await store.importFile(await fixture('a.txt', 'Photosynthesis in leaves'), defaults)
    const b = await store.importFile(await fixture('b.txt', 'Spreadsheet formulas'), {
      subject: 'Math',
      gradeLevel: 'Grade 9',
    })
    if (a.status !== 'imported' || b.status !== 'imported') throw new Error()
    await store.update(b.resource.id, { ...b.resource, tags: ['excel'] })
    expect((await store.list({ query: 'PHOTOSYNTHESIS' })).map((r) => r.id)).toEqual([
      a.resource.id,
    ])
    expect((await store.list({ subject: 'math' })).map((r) => r.id)).toEqual([b.resource.id])
    expect((await store.list({ tag: 'Excel' })).map((r) => r.id)).toEqual([b.resource.id])
    expect(await store.list({ gradeLevel: 'Grade 8', query: 'formulas' })).toEqual([])
  })

  it('deletes a resource folder and gives attachments for prompts', async () => {
    const out = await store.importFile(await fixture('c.md', '# Lesson'), defaults)
    if (out.status !== 'imported') throw new Error()
    const att = await store.toAttachment(out.resource.id)
    expect(att).toMatchObject({ name: 'c.md', kind: 'md', text: '# Lesson' })
    await store.delete(out.resource.id)
    expect(await store.all()).toEqual([])
    await expect(store.get(out.resource.id)).rejects.toThrow(/no longer exists/)
  })
})

describe('annotation checks', () => {
  const SOURCE = 'Objectives: identify 3 types of waste. Activity: 15-minute group sorting game.'
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

  it('counts paragraphs and words', () => {
    expect(splitParagraphs('a b\n\n\nc d\n')).toEqual(['a b', 'c d'])
    expect(wordCount('The teacher used 3 games — well.')).toBe(6)
    expect(joinParagraphs('First part.\n\nSecond\npart.')).toBe('First part. Second part.')
  })

  it('requires exactly the requested number of paragraphs', () => {
    const two = `${words(100)}\n\n${words(100)}`
    expect(
      checkAnnotation(two, { paragraphs: 1, length: 'medium', sourceText: SOURCE })[0].message,
    ).toBe('Exactly one paragraph was requested, but the annotation has 2.')
    expect(
      checkAnnotation(words(100), { paragraphs: 1, length: 'medium', sourceText: SOURCE }),
    ).toEqual([])
  })

  it('checks paragraph length, formatting and unsupported figures', () => {
    const w = checkAnnotation(`- ${words(20)} and 85% mastered it in 15-minute games`, {
      paragraphs: 1,
      length: 'short',
      sourceText: SOURCE,
    })
    const messages = w.map((x) => x.message)
    expect(messages).toContain('The paragraph has 27 words; the requested length is 50–80.')
    expect(messages).toContain(
      'Write plain paragraphs only — no headings, bullet points, numbered lists or tables.',
    )
    expect(messages).toContain(
      '“85%” doesn’t appear in the lesson. Remove it unless the lesson supports it.',
    )
    expect(messages.some((m) => m.includes('“15”'))).toBe(false) // 15 is in the lesson
  })

  it('needs a lesson and builds a prompt with the entire lesson and the exact paragraph rule', () => {
    const doc = newDocument('annotation', DEFAULT_TEACHING_DEFAULTS) as Annotation
    expect(validateAnnotationInputs(doc.inputs).source).toBe(
      'Choose or upload the DLL to annotate.',
    )
    const lesson = `${'A long lesson. '.repeat(3000)}FINAL-LINE`
    doc.inputs.source = {
      origin: 'resource',
      refId: 'r1',
      title: 'DLL Week 3',
      text: lesson,
      charCount: lesson.length,
    }
    expect(validateAnnotationInputs(doc.inputs)).toEqual({})
    const p = renderPromptMarkdown(buildDocumentPrompt(doc, 'generate', undefined, 'Philippines'))
    expect(p).toContain('FINAL-LINE') // nothing cut off
    expect(p).toContain('Write exactly ONE paragraph — not two, not a list.')
    expect(p).toContain('Each paragraph must have 90–130 words.')
    expect(p).toContain('Make no unsupported claims')
  })
})

describe('documents: rename and Markdown export', () => {
  it('renames, and exports plain-paragraph documents with a title heading', async () => {
    const docs = new DocumentStore(join(dir, 'documents'))
    const doc = newDocument('annotation', DEFAULT_TEACHING_DEFAULTS) as Annotation
    doc.content = 'The teacher used a sorting game.'
    const saved = await docs.save(doc)
    const renamed = await docs.rename(saved.id, '  Week 3   annotation ')
    expect(renamed.title).toBe('Week 3 annotation')
    await expect(docs.rename(saved.id, ' ')).rejects.toThrow(/Enter a title/)
    expect(documentToMarkdown(renamed)).toBe(
      '# Week 3 annotation\n\nThe teacher used a sorting game.\n',
    )
  })

  it('exports calculated documents fresh and refuses empty ones', () => {
    const rubric = newDocument('rubric', DEFAULT_TEACHING_DEFAULTS)
    expect(documentToMarkdown(rubric)).toContain('**Total score: 20 points**')
    const tos = newDocument('tos', DEFAULT_TEACHING_DEFAULTS)
    expect(documentToMarkdown(tos)).toContain('| **Total** |')
    expect(() => documentToMarkdown(newDocument('lesson-plan', DEFAULT_TEACHING_DEFAULTS))).toThrow(
      /no content/,
    )
  })
})
