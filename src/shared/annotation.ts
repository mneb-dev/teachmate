/**
 * DLL annotation settings and the checks run on an annotation: paragraph
 * count, paragraph length, plain-paragraph formatting and numbers that don't
 * appear in the lesson (unsupported claims). Pure — shared by UI, main, tests.
 */
import type { ContentWarning } from './document-rules'

export type AnnotationLength = 'short' | 'medium' | 'long'
export type AnnotationPerspective = 'first-person' | 'third-person'

export const ANNOTATION_LENGTHS: Record<
  AnnotationLength,
  { label: string; min: number; max: number }
> = {
  short: { label: 'Short', min: 50, max: 80 },
  medium: { label: 'Medium', min: 90, max: 130 },
  long: { label: 'Long', min: 140, max: 200 },
}

export const ANNOTATION_PERSPECTIVES: Record<
  AnnotationPerspective,
  { label: string; example: string }
> = {
  'first-person': { label: 'First person (teacher)', example: '“I used…”' },
  'third-person': { label: 'Third person', example: '“The teacher used…”' },
}

/** Where the annotated lesson came from. Its full text is kept with the annotation. */
export interface AnnotationSource {
  origin: 'resource' | 'document'
  refId: string
  title: string
  text: string
  charCount: number
}

export const ANNOTATION_LIMITS = {
  maxParagraphs: 5,
  sourceMaxChars: 200_000,
  focusMaxChars: 1_000,
} as const

export function splitParagraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** Join paragraphs into one (for "exactly one paragraph"). */
export function joinParagraphs(content: string): string {
  return splitParagraphs(content)
    .map((p) => p.replace(/\s*\n\s*/g, ' '))
    .join(' ')
}

/** Standalone figures (not digits inside words such as "Grade8" or "word12"). */
const NUMBER = /(?<![\p{L}\d])\d+(?:[.,]\d+)?%?(?![\p{L}\d])/gu

export interface AnnotationCheckOptions {
  paragraphs: number
  length: AnnotationLength
  /** The full lesson text — the only allowed source of facts and figures. */
  sourceText: string
}

export function checkAnnotation(content: string, o: AnnotationCheckOptions): ContentWarning[] {
  if (!content.trim()) return []
  const warnings: ContentWarning[] = []
  const paragraphs = splitParagraphs(content)
  const { min, max } = ANNOTATION_LENGTHS[o.length]

  if (paragraphs.length !== o.paragraphs) {
    warnings.push({
      kind: 'paragraphs',
      match: String(paragraphs.length),
      message:
        o.paragraphs === 1
          ? `Exactly one paragraph was requested, but the annotation has ${paragraphs.length}.`
          : `${o.paragraphs} paragraphs were requested, but the annotation has ${paragraphs.length}.`,
    })
  }

  paragraphs.forEach((p, i) => {
    const words = wordCount(p)
    if (words < min || words > max) {
      warnings.push({
        kind: 'length',
        match: String(words),
        message: `${paragraphs.length === 1 ? 'The paragraph' : `Paragraph ${i + 1}`} has ${words} words; the requested length is ${min}–${max}.`,
      })
    }
  })

  if (content.split('\n').some((l) => /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)/.test(l))) {
    warnings.push({
      kind: 'format',
      match: '',
      message:
        'Write plain paragraphs only — no headings, bullet points, numbered lists or tables.',
    })
  }

  // Every figure in the annotation must come from the lesson itself.
  const source = o.sourceText
  const seen = new Set<string>()
  for (const m of content.matchAll(NUMBER)) {
    const n = m[0]
    if (seen.has(n)) continue
    seen.add(n)
    if (!source.includes(n)) {
      warnings.push({
        kind: 'unsupported',
        match: n,
        message: `“${n}” doesn’t appear in the lesson. Remove it unless the lesson supports it.`,
      })
    }
  }
  return warnings
}
