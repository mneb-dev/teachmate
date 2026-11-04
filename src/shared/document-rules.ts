/**
 * Field validation and content checks for teaching documents. Pure functions
 * shared by the form UI (inline errors) and the main process (enforcement).
 */
import { DOCUMENT_LIMITS, type LessonPlanInputs, type ObjectivesInputs } from './documents'
import {
  BLOOM_LEVEL_IDS,
  LEARNING_DOMAIN_IDS,
  LESSON_PLAN_FORMATS,
  NON_MEASURABLE_VERBS,
} from './teaching'

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export const required = (value: string, label: string): string | undefined =>
  value.trim() ? undefined : `${label} is required.`

export const maxLen = (value: string, max: number, label: string): string | undefined =>
  value.length > max
    ? `${label} must be at most ${max.toLocaleString('en-US')} characters.`
    : undefined

export const intIn = (
  value: number,
  min: number,
  max: number,
  label: string,
): string | undefined =>
  Number.isInteger(value) && value >= min && value <= max
    ? undefined
    : `${label} must be a whole number from ${min} to ${max}.`

export function compact<T>(errors: FieldErrors<T>): FieldErrors<T> {
  for (const key of Object.keys(errors) as Array<keyof T>) {
    if (errors[key] === undefined) delete errors[key]
  }
  return errors
}

/** Loose shape check: the code is only ever typed by the teacher; we never generate one. */
const COMPETENCY_CODE_SHAPE = /^[A-Za-z0-9_./\-\s]{2,60}$/

export function codeError(code: string): string | undefined {
  if (!code.trim()) return undefined
  return COMPETENCY_CODE_SHAPE.test(code.trim())
    ? undefined
    : 'Use letters, numbers, dots, dashes, slashes or underscores only.'
}

export function validateLessonPlanInputs(i: LessonPlanInputs): FieldErrors<LessonPlanInputs> {
  const format = LESSON_PLAN_FORMATS[i.format]
  return compact<LessonPlanInputs>({
    subject:
      required(i.subject, 'Subject') ?? maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: required(i.gradeLevel, 'Grade level'),
    quarter: intIn(i.quarter, 1, 4, 'Quarter'),
    week: intIn(i.week, 1, 12, 'Week'),
    topic: required(i.topic, 'Topic') ?? maxLen(i.topic, DOCUMENT_LIMITS.fieldMaxChars, 'Topic'),
    competency:
      required(i.competency, 'Learning competency') ??
      maxLen(i.competency, DOCUMENT_LIMITS.competencyMaxChars, 'Learning competency'),
    competencyCode: codeError(i.competencyCode),
    durationMinutes: intIn(i.durationMinutes, 10, 300, 'Time allotment'),
    sessions: !format
      ? undefined
      : intIn(
          i.sessions,
          format.minSessions,
          format.maxSessions,
          `Number of sessions for a ${format.short}`,
        ),
    format: format ? undefined : 'Choose a lesson plan format.',
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

export function validateObjectivesInputs(i: ObjectivesInputs): FieldErrors<ObjectivesInputs> {
  return compact<ObjectivesInputs>({
    subject:
      required(i.subject, 'Subject') ?? maxLen(i.subject, DOCUMENT_LIMITS.fieldMaxChars, 'Subject'),
    gradeLevel: required(i.gradeLevel, 'Grade level'),
    topic: required(i.topic, 'Topic') ?? maxLen(i.topic, DOCUMENT_LIMITS.fieldMaxChars, 'Topic'),
    competency: maxLen(i.competency, DOCUMENT_LIMITS.competencyMaxChars, 'Learning competency'),
    competencyCode: codeError(i.competencyCode),
    durationMinutes: intIn(i.durationMinutes, 10, 300, 'Time allotment'),
    bloomLevels:
      i.bloomLevels.length === 0
        ? 'Choose at least one Bloom’s level.'
        : i.bloomLevels.every((b) => BLOOM_LEVEL_IDS.includes(b))
          ? undefined
          : 'Unknown Bloom’s level.',
    domains:
      i.domains.length === 0
        ? 'Choose at least one learning domain.'
        : i.domains.every((d) => LEARNING_DOMAIN_IDS.includes(d))
          ? undefined
          : 'Unknown learning domain.',
    objectivesPerLevel: intIn(i.objectivesPerLevel, 1, 5, 'Objectives per level'),
    instructions: maxLen(
      i.instructions,
      DOCUMENT_LIMITS.instructionsMaxChars,
      'Additional instructions',
    ),
  })
}

// ── Content checks (run on generated or pasted text) ───────────────────────

/**
 * Shapes like "TLE_ICTCS7/8-0a-b-1", "S8FE-Ia-15", "M8AL-Ia-b-1", "EN8RC-IIa-2.1".
 * Used only to *flag* codes for verification — TeachMate never produces codes.
 */
const CURRICULUM_CODE =
  /\b[A-Z][A-Za-z0-9_]*(?:\/\d+)?-(?:[IV]{1,4}|0)[a-j](?:-[a-j])?-\d+(?:\.\d+)?\b/g

export interface ContentWarning {
  kind:
    | 'unverified-code'
    | 'non-measurable-verb'
    | 'answer-key'
    | 'missing-section'
    | 'paragraphs'
    | 'length'
    | 'format'
    | 'unsupported'
    | 'time'
  message: string
  /** The exact text that triggered the warning. */
  match: string
}

/**
 * Flag curriculum codes in `content` that don't appear in any of `trustedSources`
 * (the teacher's inputs and reference documents).
 */
export function findUnverifiedCodes(content: string, trustedSources: string[]): ContentWarning[] {
  const trusted = trustedSources.join('\n')
  const seen = new Set<string>()
  const warnings: ContentWarning[] = []
  for (const match of content.matchAll(CURRICULUM_CODE)) {
    const code = match[0]
    if (seen.has(code) || trusted.includes(code)) continue
    seen.add(code)
    warnings.push({
      kind: 'unverified-code',
      match: code,
      message: `“${code}” looks like a curriculum code but isn’t in your inputs or reference documents. Verify it against the official DepEd curriculum guide, or remove it.`,
    })
  }
  return warnings
}

/** Flag objective lines that rely on verbs that can't be observed or measured. */
export function findNonMeasurableVerbs(content: string): ContentWarning[] {
  const warnings: ContentWarning[] = []
  const seen = new Set<string>()
  const pattern = new RegExp(
    `\\b(?:will|to|be able to|can)\\s+(${NON_MEASURABLE_VERBS.map((v) => v.replace(/ /g, '\\s+')).join('|')})\\b`,
    'i',
  )
  for (const line of content.split('\n')) {
    // Only list items and table rows — where objectives are written.
    if (!/^\s*(?:[-*+]|\d+[.)]|\|)/.test(line)) continue
    const m = line.match(pattern)
    if (!m) continue
    const verb = m[1].toLowerCase().replace(/\s+/g, ' ')
    // For table rows, quote only the cell that contains the verb.
    const source = line.trim().startsWith('|')
      ? (line.split('|').find((cell) => pattern.test(cell)) ?? line)
      : line
    const snippet = source
      .replace(/^\s*(?:[-*+]|\d+[.)]|\|)\s*/, '')
      .trim()
      .slice(0, 90)
    if (seen.has(snippet)) continue
    seen.add(snippet)
    warnings.push({
      kind: 'non-measurable-verb',
      match: verb,
      message: `“${verb}” is hard to observe or measure: “${snippet}${snippet.length >= 90 ? '…' : ''}”. Consider a measurable verb such as identify, explain or demonstrate.`,
    })
  }
  return warnings
}
