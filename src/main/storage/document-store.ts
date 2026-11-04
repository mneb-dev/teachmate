import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { calculationErrors } from '@shared/calculation-rules'
import {
  DOCUMENT_LIMITS,
  type ContentSource,
  type DocumentKind,
  type DocumentSummary,
  type TeachingDocument,
} from '@shared/documents'
import { suggestedTitle, summarizeDocument } from '@shared/document-text'
import { defaultRubric, renderRubricMarkdown } from '@shared/rubric'
import { DEFAULT_DISTRIBUTION, type TeachingDefaults } from '@shared/teaching'
import { computeTosTable, renderTosMarkdown, tableMatchesShape, type TosInputs } from '@shared/tos'
import { assertSafeId, newId } from '../lib/ids'
import { validateDocument } from './document-validation'
import { readJsonFile, writeJsonFileAtomic } from './json-file'

type Base = Omit<Extract<TeachingDocument, { kind: 'lesson-plan' }>, 'kind' | 'inputs'>
type TosDocument = Extract<TeachingDocument, { kind: 'tos' }>
type RubricDocument = Extract<TeachingDocument, { kind: 'rubric' }>

function buildDocument(kind: DocumentKind, d: TeachingDefaults, base: Base): TeachingDocument {
  switch (kind) {
    case 'lesson-plan':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          quarter: 1,
          week: 1,
          topic: '',
          competency: '',
          competencyCode: '',
          durationMinutes: d.durationMinutes,
          sessions: 1,
          format: 'dll',
          curriculum: d.curriculum,
          language: d.language,
          instructions: '',
        },
      }
    case 'learning-objectives':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          topic: '',
          competency: '',
          competencyCode: '',
          durationMinutes: d.durationMinutes,
          bloomLevels: ['remembering', 'understanding', 'applying'],
          domains: ['cognitive', 'psychomotor', 'affective'],
          objectivesPerLevel: 1,
          curriculum: d.curriculum,
          language: d.language,
          instructions: '',
        },
      }
    case 'learning-activities':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          quarter: 1,
          topic: '',
          competency: '',
          competencyCode: '',
          objectives: '',
          durationMinutes: d.durationMinutes,
          activityCount: 3,
          classSize: 40,
          resources: '',
          environment: 'classroom',
          categories: ['motivation', 'group', 'reflection'],
          difficulty: 'mixed',
          curriculum: d.curriculum,
          language: d.language,
          instructions: '',
        },
      }
    case 'assessment':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          topic: '',
          competency: '',
          competencyCode: '',
          itemCount: 20,
          difficulty: 'mixed',
          questionTypes: [
            { type: 'multiple-choice', count: 10 },
            { type: 'true-false', count: 5 },
            { type: 'identification', count: 5 },
          ],
          distribution: structuredClone(DEFAULT_DISTRIBUTION),
          includeExplanations: false,
          curriculum: d.curriculum,
          language: d.language,
          instructions: '',
          tos: null,
        },
      }
    case 'tos': {
      const inputs: TosInputs = {
        examTitle: 'Quarterly Examination',
        subject: d.subject,
        gradeLevel: d.gradeLevel,
        quarter: 1,
        totalItems: 50,
        distribution: structuredClone(DEFAULT_DISTRIBUTION),
        competencies: [{ id: newId(), competency: '', code: '', hours: 4 }],
      }
      return { ...base, kind, inputs, table: computeTosTable(inputs) }
    }
    case 'performance-task':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          competency: '',
          competencyCode: '',
          topic: '',
          days: 3,
          minutesPerDay: d.durationMinutes,
          resources: '',
          expectedOutput: '',
          grouping: 'small-groups',
          curriculum: d.curriculum,
          language: d.language,
          instructions: '',
        },
      }
    case 'rubric':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          taskTitle: '',
          competency: '',
          competencyCode: '',
          levelCount: 4,
          criteriaCount: 5,
          targetTotal: 20,
          curriculum: d.curriculum,
          language: d.language,
          instructions: '',
          task: null,
        },
        rubric: defaultRubric(4, 20, ['', '', '', '', '']),
      }
    case 'annotation':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          focus: '',
          paragraphs: 1,
          length: 'medium',
          perspective: 'first-person',
          language: d.language,
          instructions: '',
          source: null,
        },
      }
    case 'lesson-plan-review':
      return {
        ...base,
        kind,
        inputs: {
          subject: d.subject,
          gradeLevel: d.gradeLevel,
          planType: 'dll',
          depth: 'comprehensive',
          focus: 'overall',
          formatRequirements: '',
          curriculum: d.curriculum,
          language: d.language,
          instructions: '',
          source: null,
        },
        revisions: [],
      }
  }
}

/** A blank document for `kind`, pre-filled from the teaching defaults. */
export function newDocument(kind: DocumentKind, d: TeachingDefaults): TeachingDocument {
  const now = new Date().toISOString()
  const doc = buildDocument(kind, d, {
    id: newId(),
    title: '',
    createdAt: now,
    updatedAt: now,
    references: [],
    content: '',
    contentSource: null,
    versions: [],
    requests: [],
  })
  doc.title = suggestedTitle(doc)
  return doc
}

/**
 * Replace the document's content, keeping the previous content as a version
 * (newest first, capped). Returns a new object.
 */
export function replaceContent(
  doc: TeachingDocument,
  content: string,
  source: ContentSource,
): TeachingDocument {
  const versions = doc.content.trim()
    ? [
        { content: doc.content, source: doc.contentSource ?? 'edited', createdAt: doc.updatedAt },
        ...doc.versions,
      ].slice(0, DOCUMENT_LIMITS.versionsKept)
    : doc.versions
  return { ...doc, content, contentSource: source, versions }
}

/** Recalculate a missing or out-of-shape TOS table so it always describes its inputs. */
export function prepareTos(doc: TosDocument): TosDocument {
  return tableMatchesShape(doc.inputs, doc.table)
    ? doc
    : { ...doc, table: computeTosTable(doc.inputs) }
}

/** A TOS's Markdown content is always rendered from its validated table. */
function withTosContent(doc: TosDocument): TosDocument {
  if (!doc.table) return doc
  return {
    ...doc,
    content: renderTosMarkdown(doc.title, doc.inputs, doc.table),
    contentSource: 'computed',
  }
}

/** A rubric's Markdown content is always rendered from its (validated) structure. */
function withRubricContent(doc: RubricDocument): RubricDocument {
  const subtitle = [doc.inputs.subject, doc.inputs.gradeLevel, doc.inputs.taskTitle]
    .filter((s) => s.trim())
    .join(' · ')
  return {
    ...doc,
    content: renderRubricMarkdown(doc.title, doc.rubric, subtitle),
    contentSource: 'computed',
  }
}

/** Stores each document as `<id>.json`. Pure Node.js (no Electron) for testability. */
export class DocumentStore {
  constructor(private readonly dir: string) {}

  private fileFor(id: string): string {
    return join(this.dir, `${assertSafeId(id, 'document id')}.json`)
  }

  private async readAll(): Promise<TeachingDocument[]> {
    await mkdir(this.dir, { recursive: true })
    const docs: TeachingDocument[] = []
    for (const file of (await readdir(this.dir)).filter((f) => f.endsWith('.json'))) {
      try {
        docs.push(validateDocument(await readJsonFile(join(this.dir, file))))
      } catch (err) {
        console.warn(`[storage] skipping unreadable document ${file}:`, (err as Error).message)
      }
    }
    return docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async list(kind?: DocumentKind): Promise<DocumentSummary[]> {
    return (await this.readAll()).filter((d) => !kind || d.kind === kind).map(summarizeDocument)
  }

  async get(id: string): Promise<TeachingDocument | null> {
    const data = await readJsonFile(this.fileFor(id))
    return data === null ? null : validateDocument(data)
  }

  async require(id: string): Promise<TeachingDocument> {
    const doc = await this.get(id)
    if (!doc) throw new Error('Document not found. It may have been deleted.')
    return doc
  }

  /**
   * Validate and write. Calculations (question-type totals, Bloom's
   * percentages, TOS row/column totals) must be correct or the save is refused.
   */
  async save(input: unknown): Promise<TeachingDocument> {
    let doc = validateDocument(input)
    if (!doc.title.trim()) doc.title = suggestedTitle(doc)
    if (doc.kind === 'tos') doc = prepareTos(doc)
    const problems = calculationErrors(doc)
    if (problems.length > 0) {
      throw new Error(`Fix the calculations before saving: ${problems.join(' ')}`)
    }
    if (doc.kind === 'tos') doc = withTosContent(doc)
    if (doc.kind === 'rubric') doc = withRubricContent(doc)
    doc.updatedAt = new Date().toISOString()
    await writeJsonFileAtomic(this.fileFor(doc.id), doc)
    return doc
  }

  async rename(id: string, title: unknown): Promise<TeachingDocument> {
    if (typeof title !== 'string' || !title.trim()) throw new Error('Enter a title.')
    const clean = title.trim().replace(/\s+/g, ' ')
    if (clean.length > DOCUMENT_LIMITS.titleMaxChars) {
      throw new Error(`Titles can be at most ${DOCUMENT_LIMITS.titleMaxChars} characters.`)
    }
    return this.save({ ...(await this.require(id)), title: clean })
  }

  async delete(id: string): Promise<void> {
    await rm(this.fileFor(id), { force: true })
  }
}
