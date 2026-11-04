/**
 * Rubric data model and maths. The AI may draft criteria and descriptors,
 * but every number (level scores, weights, points, total) is set and checked
 * here — pure functions shared by the UI, the main process and the tests.
 */

export type RubricType = 'analytic' | 'holistic'
export type RubricLevelCount = 4 | 5

/** Analytic level: one column, worth `score` points per weight unit. */
export interface RubricLevel {
  id: string
  label: string
  score: number
}

/** Analytic criterion: one row, with a descriptor per level (highest level first). */
export interface RubricCriterion {
  id: string
  name: string
  /** Multiplier: points for a cell = level score × weight. */
  weight: number
  descriptors: string[]
}

/** Holistic level: one overall description and a range of points. */
export interface HolisticLevel {
  id: string
  label: string
  minPoints: number
  maxPoints: number
  description: string
}

export interface RubricData {
  type: RubricType
  /** Analytic levels, highest first. */
  levels: RubricLevel[]
  criteria: RubricCriterion[]
  /** Holistic levels, highest first. */
  holistic: HolisticLevel[]
}

export const RUBRIC_LIMITS = {
  maxCriteria: 12,
  maxWeight: 100,
  maxScore: 100,
  maxTotal: 1_000,
  descriptorMaxChars: 1_000,
} as const

export const DEFAULT_LEVEL_LABELS: Record<RubricLevelCount, string[]> = {
  4: ['Excellent', 'Proficient', 'Developing', 'Beginning'],
  5: [
    'Outstanding',
    'Very Satisfactory',
    'Satisfactory',
    'Fairly Satisfactory',
    'Did Not Meet Expectations',
  ],
}

let counter = 0
/** Ids only need to be unique within a document; callers may pass their own generator. */
export const rubricId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r${Date.now().toString(36)}${(counter++).toString(36)}`

export function defaultLevels(count: RubricLevelCount): RubricLevel[] {
  return DEFAULT_LEVEL_LABELS[count].map((label, i) => ({
    id: rubricId(),
    label,
    score: count - i,
  }))
}

/**
 * Split 0..total into `count` contiguous point ranges, highest first, as
 * evenly as possible (e.g. 20 points, 4 levels → 16–20, 11–15, 6–10, 0–5).
 */
export function defaultHolisticRanges(total: number, count: number): Array<[number, number]> {
  const sizes = Array.from(
    { length: count },
    (_, i) => Math.floor((total + 1) / count) + (i < (total + 1) % count ? 1 : 0),
  )
  const ranges: Array<[number, number]> = []
  let top = total
  for (const size of sizes) {
    const bottom = Math.max(0, top - size + 1)
    ranges.push([bottom, top])
    top = bottom - 1
  }
  return ranges
}

export function defaultHolistic(count: RubricLevelCount, total: number): HolisticLevel[] {
  const ranges = defaultHolisticRanges(total, count)
  return DEFAULT_LEVEL_LABELS[count].map((label, i) => ({
    id: rubricId(),
    label,
    minPoints: ranges[i][0],
    maxPoints: ranges[i][1],
    description: '',
  }))
}

export function newCriterion(name: string, levelCount: number, weight = 1): RubricCriterion {
  return { id: rubricId(), name, weight, descriptors: Array.from({ length: levelCount }, () => '') }
}

export function defaultRubric(
  count: RubricLevelCount,
  total: number,
  names: string[] = [],
): RubricData {
  const criteria = (names.length ? names : ['', '', '']).map((n) => newCriterion(n, count))
  return {
    type: 'analytic',
    levels: defaultLevels(count),
    criteria,
    holistic: defaultHolistic(count, total),
  }
}

/** Change the number of levels, keeping existing text where possible. */
export function resizeLevels(r: RubricData, count: RubricLevelCount, total: number): RubricData {
  const labels = DEFAULT_LEVEL_LABELS[count]
  return {
    ...r,
    levels: labels.map((label, i) => ({
      id: r.levels[i]?.id ?? rubricId(),
      label,
      score: count - i,
    })),
    criteria: r.criteria.map((c) => ({
      ...c,
      descriptors: Array.from({ length: count }, (_, i) => c.descriptors[i] ?? ''),
    })),
    holistic: defaultHolistic(count, total).map((h, i) => ({
      ...h,
      description: r.holistic[i]?.description ?? '',
    })),
  }
}

// ── Scoring ────────────────────────────────────────────────────────────────

/** Points for criterion `c` at level index `levelIndex` (analytic). */
export function cellPoints(r: RubricData, c: RubricCriterion, levelIndex: number): number {
  return (r.levels[levelIndex]?.score ?? 0) * c.weight
}

/** Maximum points per criterion (analytic). */
export function criterionMaxPoints(r: RubricData): number[] {
  const top = r.levels[0]?.score ?? 0
  return r.criteria.map((c) => top * c.weight)
}

/** Total score of the rubric: Σ(top score × weight) for analytic; the top range for holistic. */
export function rubricTotal(r: RubricData): number {
  if (r.type === 'holistic') return r.holistic[0]?.maxPoints ?? 0
  return criterionMaxPoints(r).reduce((a, b) => a + b, 0)
}

export interface RubricCheck {
  ok: boolean
  total: number
  perCriterion: number[]
  /** Blocking calculation problems. */
  errors: string[]
  /** Incomplete text (empty names or descriptors) — not blocking for saving. */
  warnings: string[]
}

const isInt = (v: number) => Number.isInteger(v)

/**
 * Check every number in a rubric: level scores (whole, descending), weights,
 * holistic ranges (contiguous, no gaps/overlaps) and the total against an
 * optional target.
 */
export function checkRubric(
  r: RubricData,
  levelCount: number,
  targetTotal: number | null,
): RubricCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (r.type === 'analytic') {
    if (r.levels.length !== levelCount) {
      errors.push(`The rubric has ${r.levels.length} levels; it should have ${levelCount}.`)
    }
    r.levels.forEach((l, i) => {
      if (!isInt(l.score) || l.score < 0 || l.score > RUBRIC_LIMITS.maxScore) {
        errors.push(
          `Level “${l.label || i + 1}” must score a whole number from 0 to ${RUBRIC_LIMITS.maxScore}.`,
        )
      }
      if (!l.label.trim()) warnings.push(`Level ${i + 1} has no label.`)
    })
    for (let i = 1; i < r.levels.length; i++) {
      if (r.levels[i].score >= r.levels[i - 1].score) {
        errors.push(
          `Level scores must go down from left to right: “${r.levels[i - 1].label}” (${r.levels[i - 1].score}) must be higher than “${r.levels[i].label}” (${r.levels[i].score}).`,
        )
      }
    }
    if ((r.levels[0]?.score ?? 0) <= 0)
      errors.push('The highest level must be worth more than 0 points.')
    if (r.criteria.length === 0) errors.push('Add at least one criterion.')
    if (r.criteria.length > RUBRIC_LIMITS.maxCriteria) {
      errors.push(`Use at most ${RUBRIC_LIMITS.maxCriteria} criteria.`)
    }
    r.criteria.forEach((c, i) => {
      if (!isInt(c.weight) || c.weight < 1 || c.weight > RUBRIC_LIMITS.maxWeight) {
        errors.push(
          `Criterion ${i + 1}: weight must be a whole number from 1 to ${RUBRIC_LIMITS.maxWeight}.`,
        )
      }
      if (c.descriptors.length !== r.levels.length) {
        errors.push(`Criterion ${i + 1} needs one description per level.`)
      }
      if (!c.name.trim()) warnings.push(`Criterion ${i + 1} has no name.`)
    })
    const empty = r.criteria.reduce((a, c) => a + c.descriptors.filter((d) => !d.trim()).length, 0)
    if (empty > 0)
      warnings.push(`${empty} description${empty === 1 ? ' is' : 's are'} still empty.`)
  } else {
    if (r.holistic.length !== levelCount) {
      errors.push(`The rubric has ${r.holistic.length} levels; it should have ${levelCount}.`)
    }
    r.holistic.forEach((h, i) => {
      const name = `“${h.label || `Level ${i + 1}`}”`
      if (!isInt(h.minPoints) || !isInt(h.maxPoints) || h.minPoints < 0) {
        errors.push(`${name}: points must be whole numbers of 0 or more.`)
      } else if (h.minPoints > h.maxPoints) {
        errors.push(
          `${name}: the lowest score (${h.minPoints}) is above the highest (${h.maxPoints}).`,
        )
      }
      if (!h.label.trim()) warnings.push(`Level ${i + 1} has no label.`)
      if (!h.description.trim()) warnings.push(`${name} has no description.`)
    })
    for (let i = 1; i < r.holistic.length; i++) {
      const upper = r.holistic[i - 1]
      const lower = r.holistic[i]
      if (lower.maxPoints + 1 !== upper.minPoints) {
        errors.push(
          lower.maxPoints >= upper.minPoints
            ? `Point ranges overlap: “${lower.label}” ends at ${lower.maxPoints} but “${upper.label}” starts at ${upper.minPoints}.`
            : `Point ranges leave a gap: “${lower.label}” ends at ${lower.maxPoints} but “${upper.label}” starts at ${upper.minPoints}.`,
        )
      }
    }
    if (targetTotal === null) errors.push('Set the total score for a holistic rubric.')
  }

  const total = rubricTotal(r)
  if (total > RUBRIC_LIMITS.maxTotal) errors.push(`The total score (${total}) is too large.`)
  if (targetTotal !== null && total !== targetTotal) {
    if (r.type === 'holistic') {
      errors.push(
        `The highest range ends at ${total} points, but the total score is ${targetTotal}.`,
      )
    } else {
      const top = r.levels[0]?.score ?? 0
      const weights = r.criteria.reduce((a, c) => a + c.weight, 0)
      const hint =
        top > 0 && targetTotal % top === 0
          ? ` With a top score of ${top}, the weights must add up to ${targetTotal / top} (now ${weights}).`
          : top > 0
            ? ` ${targetTotal} is not a multiple of the top score (${top}); change the level scores or the target.`
            : ''
      errors.push(`The rubric totals ${total} points, but the target is ${targetTotal}.${hint}`)
    }
  }

  return {
    ok: errors.length === 0,
    total,
    perCriterion: r.type === 'analytic' ? criterionMaxPoints(r) : [],
    errors,
    warnings,
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────

const cellText = (s: string) =>
  s
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim() || '—'
const pts = (n: number) => `${n} pt${n === 1 ? '' : 's'}`

export function renderRubricMarkdown(title: string, r: RubricData, subtitle = ''): string {
  const total = rubricTotal(r)
  const lines = [`# ${title || 'Rubric'}`, '']
  if (subtitle) lines.push(subtitle, '')
  if (r.type === 'analytic') {
    const head = ['Criterion', ...r.levels.map((l) => `${l.label} (${l.score})`), 'Max']
    lines.push(`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`)
    const max = criterionMaxPoints(r)
    r.criteria.forEach((c, i) => {
      const name = c.weight === 1 ? cellText(c.name) : `${cellText(c.name)} (×${c.weight})`
      const cells = c.descriptors.map((d, j) => `${cellText(d)} **(${pts(cellPoints(r, c, j))})**`)
      lines.push(`| ${name} | ${cells.join(' | ')} | ${max[i]} |`)
    })
    lines.push(`| **Total score** | ${r.levels.map(() => '').join(' | ')} | **${total}** |`)
  } else {
    lines.push('| Level | Points | Description |', '| --- | --- | --- |')
    for (const h of r.holistic) {
      lines.push(
        `| ${cellText(h.label)} | ${h.minPoints}–${h.maxPoints} | ${cellText(h.description)} |`,
      )
    }
  }
  lines.push('', `**Total score: ${total} points**`)
  return lines.join('\n') + '\n'
}

// ── Reading an AI reply ────────────────────────────────────────────────────

function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return body.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim())
}

const plain = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** First Markdown table in `md`: header cells and body rows. */
function firstTable(md: string): { header: string[]; rows: string[][] } | null {
  const lines = md.split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const header = splitRow(lines[i]).map(plain)
      const rows: string[][] = []
      for (let k = i + 2; k < lines.length && lines[k].trim().startsWith('|'); k++) {
        rows.push(splitRow(lines[k]).map(plain))
      }
      return { header, rows }
    }
  }
  return null
}

export class RubricParseError extends Error {}

/**
 * Read criteria and descriptions from a Markdown table in an AI reply into
 * the rubric. Numbers in the reply are ignored: level scores, weights and
 * ranges stay exactly as the teacher set them.
 */
export function applyRubricReply(md: string, r: RubricData): RubricData {
  const table = firstTable(md)
  if (!table) {
    throw new RubricParseError(
      'No rubric table was found in the reply. Paste the whole reply, including the Markdown table.',
    )
  }
  const isNumberColumn = (h: string) => /^(weight|points?|max|total|score)\b/i.test(h)

  if (r.type === 'holistic') {
    const descCol = table.header.findIndex((h) => /descri/i.test(h))
    const col = descCol >= 0 ? descCol : table.header.length - 1
    const rows = table.rows.filter((row) => row.some((c) => c) && !/^total/i.test(row[0] ?? ''))
    if (rows.length !== r.holistic.length) {
      throw new RubricParseError(
        `The reply has ${rows.length} level rows, but this rubric has ${r.holistic.length} levels.`,
      )
    }
    return {
      ...r,
      holistic: r.holistic.map((h, i) => ({ ...h, description: rows[i][col] ?? '' })),
    }
  }

  const levelCols = table.header
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i > 0 && !isNumberColumn(h))
    .map(({ i }) => i)
  if (levelCols.length !== r.levels.length) {
    throw new RubricParseError(
      `The reply’s table has ${levelCols.length} level columns, but this rubric has ${r.levels.length} levels.`,
    )
  }
  const rows = table.rows.filter((row) => row[0] && !/^total/i.test(row[0]))
  if (rows.length === 0) throw new RubricParseError('The reply’s table has no criteria rows.')
  if (rows.length > RUBRIC_LIMITS.maxCriteria) {
    throw new RubricParseError(
      `The reply has ${rows.length} criteria; the maximum is ${RUBRIC_LIMITS.maxCriteria}.`,
    )
  }

  const byName = new Map(r.criteria.map((c) => [c.name.trim().toLowerCase(), c]))
  const criteria = rows.map((row, i) => {
    const name = row[0]
      .replace(/\s*\((?:×|x)\s*\d+\)\s*$/i, '')
      .replace(/\s*\(\d+%?\)\s*$/, '')
      .trim()
    const existing =
      byName.get(name.toLowerCase()) ?? (r.criteria[i]?.name.trim() ? undefined : r.criteria[i])
    return {
      id: existing?.id ?? rubricId(),
      name,
      weight: existing?.weight ?? 1,
      descriptors: levelCols.map((col) =>
        (row[col] ?? '').replace(/\s*\(?\d+\s*(?:pts?|points?)\)?\s*$/i, '').trim(),
      ),
    }
  })
  return { ...r, criteria }
}
