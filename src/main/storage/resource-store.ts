import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { ATTACHMENT_EXTENSIONS, LIMITS, type Attachment } from '@shared/conversations'
import {
  RESOURCE_LIMITS,
  normalizeTags,
  titleFromFileName,
  type ResourceDetail,
  type ResourceFilter,
  type ResourceMeta,
} from '@shared/resources'
import { attachmentKindOf, extractAttachment } from '../attachments/extract'
import { assertSafeId, isSafeId, newId } from '../lib/ids'
import { readJsonFile, writeJsonFileAtomic } from './json-file'
import { arr, isoDate, obj, str } from './validation'

const META = 'resource.json'
const TEXT = 'extracted.txt'

function validateMeta(value: unknown): ResourceMeta {
  const o = obj(value, 'resource')
  const kind = o.kind
  if (!(ATTACHMENT_EXTENSIONS as readonly unknown[]).includes(kind)) {
    throw new Error('Invalid data: resource.kind')
  }
  const num = (v: unknown, path: string) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0)
      throw new Error(`Invalid data: ${path}`)
    return v
  }
  if (!isSafeId(o.id)) throw new Error('Invalid data: resource.id')
  return {
    id: o.id,
    title: str(o.title, 'title', RESOURCE_LIMITS.titleMaxChars, false),
    originalName: str(o.originalName, 'originalName', 260, false),
    kind: kind as ResourceMeta['kind'],
    size: num(o.size, 'size'),
    sha256: str(o.sha256, 'sha256', 64, false),
    subject: str(o.subject, 'subject', 500),
    gradeLevel: str(o.gradeLevel, 'gradeLevel', 500),
    tags: normalizeTags(arr(o.tags, 'tags', 100).map((t, i) => str(t, `tags[${i}]`, 100))),
    description: str(o.description, 'description', RESOURCE_LIMITS.descriptionMaxChars),
    createdAt: isoDate(o.createdAt, 'createdAt'),
    updatedAt: isoDate(o.updatedAt, 'updatedAt'),
    charCount: num(o.charCount, 'charCount'),
    truncated: o.truncated === true,
  }
}

/** Validate edits from the renderer. */
export function parseResourceUpdate(value: unknown) {
  const o = obj(value, 'update')
  const title = str(o.title, 'Title', RESOURCE_LIMITS.titleMaxChars * 4)
    .trim()
    .replace(/\s+/g, ' ')
  if (!title) throw new Error('Title is required.')
  if (title.length > RESOURCE_LIMITS.titleMaxChars) {
    throw new Error(`Title must be at most ${RESOURCE_LIMITS.titleMaxChars} characters.`)
  }
  return {
    title,
    subject: str(o.subject, 'Subject', 500).trim(),
    gradeLevel: str(o.gradeLevel, 'Grade level', 500).trim(),
    tags: normalizeTags(arr(o.tags, 'Tags', 100).map((t, i) => str(t, `tags[${i}]`, 200))),
    description: str(o.description, 'Description', RESOURCE_LIMITS.descriptionMaxChars).trim(),
  }
}

export type ImportOutcome =
  { status: 'imported'; resource: ResourceMeta } | { status: 'duplicate'; existing: ResourceMeta }

/**
 * The teaching resource library. Each resource lives in its own folder:
 *   <id>/original.<ext>   the untouched file the teacher chose
 *   <id>/extracted.txt    its text, for previews and AI prompts
 *   <id>/resource.json    metadata (subject, grade, tags, …)
 * Imports never overwrite anything: every resource gets a new folder and
 * files are created with exclusive flags.
 */
export class ResourceStore {
  constructor(private readonly dir: string) {}

  private folder(id: string): string {
    return join(this.dir, assertSafeId(id, 'resource id'))
  }

  originalPath(meta: ResourceMeta): string {
    return join(this.folder(meta.id), `original.${meta.kind}`)
  }

  private async readMeta(id: string): Promise<ResourceMeta | null> {
    const data = await readJsonFile(join(this.folder(id), META))
    return data === null ? null : validateMeta(data)
  }

  async require(id: string): Promise<ResourceMeta> {
    const meta = await this.readMeta(id)
    if (!meta) throw new Error('This resource no longer exists.')
    return meta
  }

  async text(id: string): Promise<string> {
    try {
      return await readFile(join(this.folder(id), TEXT), 'utf8')
    } catch {
      return ''
    }
  }

  async all(): Promise<ResourceMeta[]> {
    await mkdir(this.dir, { recursive: true })
    const out: ResourceMeta[] = []
    for (const entry of await readdir(this.dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isSafeId(entry.name)) continue
      try {
        const meta = await this.readMeta(entry.name)
        if (meta) out.push(meta)
      } catch (err) {
        console.warn(`[resources] skipping ${entry.name}:`, (err as Error).message)
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  /** Filter by subject/grade/tag; the query matches metadata and the extracted text. */
  async list(filter: ResourceFilter = {}): Promise<ResourceMeta[]> {
    const q = filter.query?.trim().toLowerCase() ?? ''
    const eq = (a: string, b?: string) => !b || a.toLowerCase() === b.toLowerCase()
    const out: ResourceMeta[] = []
    for (const r of await this.all()) {
      if (!eq(r.subject, filter.subject) || !eq(r.gradeLevel, filter.gradeLevel)) continue
      if (filter.tag && !r.tags.some((t) => t.toLowerCase() === filter.tag!.toLowerCase())) continue
      if (q) {
        const meta = [r.title, r.originalName, r.subject, r.gradeLevel, r.description, ...r.tags]
          .join('\n')
          .toLowerCase()
        if (!meta.includes(q) && !(await this.text(r.id)).toLowerCase().includes(q)) continue
      }
      out.push(r)
    }
    return out
  }

  async get(id: string): Promise<ResourceDetail> {
    return { ...(await this.require(id)), text: await this.text(id) }
  }

  async findByHash(sha256: string): Promise<ResourceMeta | null> {
    return (await this.all()).find((r) => r.sha256 === sha256) ?? null
  }

  async importFile(
    filePath: string,
    defaults: { subject: string; gradeLevel: string },
    { allowDuplicate = false } = {},
  ): Promise<ImportOutcome> {
    const kind = attachmentKindOf(filePath)
    if (!kind) throw new Error('Unsupported file type. Use DOCX, PDF, TXT or MD.')
    const info = await stat(filePath)
    if (!info.isFile()) throw new Error('Not a file.')
    if (info.size > LIMITS.attachmentFileMaxBytes) {
      throw new Error(`File is larger than ${LIMITS.attachmentFileMaxBytes / 1024 / 1024} MB.`)
    }
    const sha256 = createHash('sha256')
      .update(await readFile(filePath))
      .digest('hex')
    if (!allowDuplicate) {
      const existing = await this.findByHash(sha256)
      if (existing) return { status: 'duplicate', existing }
    }

    // Extract first so a broken file never leaves a half-created resource.
    const extracted = await extractAttachment(filePath)
    const id = newId()
    const folder = this.folder(id)
    await mkdir(this.dir, { recursive: true })
    await mkdir(folder) // not recursive: fails rather than reuse an existing folder
    try {
      const now = new Date().toISOString()
      const meta: ResourceMeta = {
        id,
        title: titleFromFileName(basename(filePath)),
        originalName: basename(filePath),
        kind,
        size: info.size,
        sha256,
        subject: defaults.subject,
        gradeLevel: defaults.gradeLevel,
        tags: [],
        description: '',
        createdAt: now,
        updatedAt: now,
        charCount: extracted.charCount,
        truncated: extracted.truncated,
      }
      await copyFile(filePath, join(folder, `original.${kind}`), constants.COPYFILE_EXCL)
      await writeFile(join(folder, TEXT), extracted.text, { encoding: 'utf8', flag: 'wx' })
      await writeJsonFileAtomic(join(folder, META), meta)
      return { status: 'imported', resource: meta }
    } catch (err) {
      await rm(folder, { recursive: true, force: true })
      throw err
    }
  }

  async update(id: string, patch: unknown): Promise<ResourceMeta> {
    const meta = await this.require(id)
    const next: ResourceMeta = {
      ...meta,
      ...parseResourceUpdate(patch),
      updatedAt: new Date().toISOString(),
    }
    await writeJsonFileAtomic(join(this.folder(id), META), next)
    return next
  }

  async delete(id: string): Promise<void> {
    await rm(this.folder(id), { recursive: true, force: true })
  }

  /** The resource's text as an attachment, for use as a reference in prompts. */
  async toAttachment(id: string): Promise<Attachment> {
    const r = await this.get(id)
    return {
      id: newId(),
      name: r.originalName,
      kind: r.kind,
      size: r.size,
      text: r.text,
      charCount: r.charCount,
      truncated: r.truncated,
    }
  }
}
