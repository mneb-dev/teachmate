/**
 * Teaching resource library: files imported from the teacher's computer,
 * stored (original + extracted text) in the app's data folder.
 */
import type { AttachmentKind } from './conversations'
import type { AttachmentError } from './ipc'

export interface ResourceMeta {
  id: string
  title: string
  /** File name as it was on the teacher's computer. */
  originalName: string
  kind: AttachmentKind
  /** Size of the preserved original, in bytes. */
  size: number
  /** SHA-256 of the original file, used to spot duplicates. */
  sha256: string
  subject: string
  gradeLevel: string
  tags: string[]
  description: string
  createdAt: string
  updatedAt: string
  /** Length of the extracted text. */
  charCount: number
  truncated: boolean
}

export interface ResourceDetail extends ResourceMeta {
  /** Extracted text (used for previews and AI prompts). */
  text: string
}

export interface ResourceUpdate {
  title: string
  subject: string
  gradeLevel: string
  tags: string[]
  description: string
}

export interface ResourceFilter {
  query?: string
  subject?: string
  gradeLevel?: string
  tag?: string
}

export interface ResourceDuplicate {
  /** Pass to `resources.importDuplicate` to import it anyway. */
  token: string
  name: string
  existingTitle: string
  existingId: string
}

export interface ResourceImportResult {
  imported: ResourceMeta[]
  errors: AttachmentError[]
  duplicates: ResourceDuplicate[]
}

export const RESOURCE_LIMITS = {
  titleMaxChars: 160,
  descriptionMaxChars: 2_000,
  tagsMax: 12,
  tagMaxChars: 30,
  filesPerImport: 20,
} as const

/** Trim, collapse spaces, drop empties and case-insensitive duplicates, cap count/length. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, ' ').trim().slice(0, RESOURCE_LIMITS.tagMaxChars)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= RESOURCE_LIMITS.tagsMax) break
  }
  return out
}

/** "a, b;c" → ["a", "b", "c"] */
export function parseTagInput(input: string): string[] {
  return normalizeTags(input.split(/[,;\n]/))
}

export function titleFromFileName(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, RESOURCE_LIMITS.titleMaxChars) || 'Untitled resource'
  )
}
