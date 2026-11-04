/**
 * Table of Specifications and Bloom's distribution maths. Pure functions used
 * by the UI (live table), the main process (validation before saving and DOCX
 * export) and the prompt builders.
 */
import { BLOOM_GROUPS, BLOOM_LEVELS, type BloomDistribution, type BloomMode } from './teaching'

export interface DistributionColumn {
  id: string
  label: string
  /** Short header for tables, e.g. "Remembering" or "Easy". */
  short: string
}

export function distributionColumns(mode: BloomMode): DistributionColumn[] {
  return mode === 'grouped'
    ? BLOOM_GROUPS.map((g) => ({ id: g.id, label: g.label, short: g.short }))
    : BLOOM_LEVELS.map((b) => ({ id: b.id, label: b.label, short: b.label }))
}

/** Percentages for the active mode, in column order. */
export function distributionPercents(d: BloomDistribution): number[] {
  return d.mode === 'grouped'
    ? BLOOM_GROUPS.map((g) => d.groups[g.id])
    : BLOOM_LEVELS.map((b) => d.levels[b.id])
}

export function withDistributionPercents(
  d: BloomDistribution,
  values: number[],
): BloomDistribution {
  if (d.mode === 'grouped') {
    const groups = { ...d.groups }
    BLOOM_GROUPS.forEach((g, i) => (groups[g.id] = values[i] ?? 0))
    return { ...d, groups }
  }
  const levels = { ...d.levels }
  BLOOM_LEVELS.forEach((b, i) => (levels[b.id] = values[i] ?? 0))
  return { ...d, levels }
}

export function distributionError(d: BloomDistribution): string | undefined {
  const values = distributionPercents(d)
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 100)) {
    return 'Each percentage must be a whole number from 0 to 100.'
  }
  const sum = values.reduce((a, b) => a + b, 0)
  return sum === 100 ? undefined : `Percentages must add up to 100% (currently ${sum}%).`
}

/**
 * Split `total` into whole numbers proportional to `weights` so that they sum
 * to exactly `total` (Hamilton / largest-remainder method). Ties go to the
 * earlier entry, so results are deterministic.
 */
export function largestRemainder(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (total <= 0 || sum <= 0) return weights.map(() => 0)
  const exact = weights.map((w) => (total * w) / sum)
  const result = exact.map(Math.floor)
  let remaining = total - result.reduce((a, b) => a + b, 0)
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (remaining <= 0) break
    result[i]++
    remaining--
  }
  return result
}

/** Item counts per Bloom column for `itemCount` items. */
export function distributionCounts(itemCount: number, d: BloomDistribution): number[] {
  return largestRemainder(itemCount, distributionPercents(d))
}

/**
 * Fill a matrix with whole numbers whose row sums equal `rowTotals` and column
 * sums equal `columnTotals` (both must have the same grand total), staying as
 * close as possible to a proportional split.
 */
export function apportionMatrix(rowTotals: number[], columnTotals: number[]): number[][] {
  const grand = rowTotals.reduce((a, b) => a + b, 0)
  if (grand !== columnTotals.reduce((a, b) => a + b, 0)) {
    throw new Error('Row and column totals must have the same sum')
  }
  const cells = rowTotals.map(() => columnTotals.map(() => 0))
  if (grand === 0) return cells

  const ideal = rowTotals.map((r) => columnTotals.map((c) => (r * c) / grand))
  const rowLeft = [...rowTotals]
  const colLeft = [...columnTotals]
  ideal.forEach((row, i) =>
    row.forEach((x, j) => {
      const v = Math.floor(x)
      cells[i][j] = v
      rowLeft[i] -= v
      colLeft[j] -= v
    }),
  )

  // Hand out the remaining units to the cells with the largest fractional parts.
  const order = ideal
    .flatMap((row, i) => row.map((x, j) => ({ i, j, frac: x - Math.floor(x) })))
    .sort((a, b) => b.frac - a.frac || a.i - b.i || a.j - b.j)
  for (const { i, j } of order) {
    if (rowLeft[i] > 0 && colLeft[j] > 0) {
      cells[i][j]++
      rowLeft[i]--
      colLeft[j]--
    }
  }
  // Anything left (rare) is placed wherever both a row and a column still need units.
  for (let i = 0; i < cells.length; i++) {
    for (let j = 0; j < columnTotals.length && rowLeft[i] > 0; j++) {
      const n = Math.min(rowLeft[i], colLeft[j])
      if (n > 0) {
        cells[i][j] += n
        rowLeft[i] -= n
        colLeft[j] -= n
      }
    }
  }
  return cells
}

// ── TOS ────────────────────────────────────────────────────────────────────

export interface TosCompetency {
  id: string
  competency: string
  /** Only ever typed by the teacher. */
  code: string
  hours: number
}

export interface TosInputs {
  examTitle: string
  subject: string
  gradeLevel: string
  quarter: number
  totalItems: number
  distribution: BloomDistribution
  competencies: TosCompetency[]
}

export interface TosTable {
  mode: BloomMode
  rows: Array<{ competencyId: string; cells: number[] }>
  /** True once the teacher has edited cells by hand. */
  edited: boolean
}

export const TOS_LIMITS = {
  maxCompetencies: 30,
  maxItems: 200,
  maxHours: 500,
} as const

export function totalHours(inputs: TosInputs): number {
  return inputs.competencies.reduce((a, c) => a + (Number.isFinite(c.hours) ? c.hours : 0), 0)
}

/** Items per competency, proportional to teaching hours. */
export function rowItemTargets(inputs: TosInputs): number[] {
  return largestRemainder(
    inputs.totalItems,
    inputs.competencies.map((c) => Math.max(0, c.hours)),
  )
}

/** Percent of teaching time per competency, rounded to 2 decimals and summing to exactly 100. */
export function rowPercents(inputs: TosInputs): number[] {
  return largestRemainder(
    10_000,
    inputs.competencies.map((c) => Math.max(0, c.hours)),
  ).map((v) => v / 100)
}

export function columnItemTargets(inputs: TosInputs): number[] {
  return distributionCounts(inputs.totalItems, inputs.distribution)
}

/** The calculated table: rows proportional to hours, columns to the Bloom's distribution. */
export function computeTosTable(inputs: TosInputs): TosTable {
  const cells = apportionMatrix(rowItemTargets(inputs), columnItemTargets(inputs))
  return {
    mode: inputs.distribution.mode,
    rows: inputs.competencies.map((c, i) => ({ competencyId: c.id, cells: cells[i] })),
    edited: false,
  }
}

/** Does `table` still describe these inputs (same rows and columns)? */
export function tableMatchesShape(inputs: TosInputs, table: TosTable | null): table is TosTable {
  if (!table || table.mode !== inputs.distribution.mode) return false
  const columns = distributionColumns(table.mode).length
  return (
    table.rows.length === inputs.competencies.length &&
    table.rows.every(
      (r, i) => r.competencyId === inputs.competencies[i].id && r.cells.length === columns,
    )
  )
}

export interface TosCheck {
  ok: boolean
  rowTargets: number[]
  columnTargets: number[]
  rowTotals: number[]
  columnTotals: number[]
  grandTotal: number
  /** Per row: message when the row total doesn't match its target. */
  rowErrors: Array<string | null>
  columnErrors: Array<string | null>
  /** Problems that aren't tied to one row or column. */
  errors: string[]
  /** Not blocking, e.g. a competency that gets no items. */
  warnings: string[]
}

/** Validate every row total, column total and the grand total of a TOS table. */
export function checkTosTable(inputs: TosInputs, table: TosTable | null): TosCheck {
  const columns = distributionColumns(inputs.distribution.mode)
  const rowTargets = rowItemTargets(inputs)
  const columnTargets = columnItemTargets(inputs)
  const errors: string[] = []
  const warnings: string[] = []

  if (!tableMatchesShape(inputs, table)) {
    return {
      ok: false,
      rowTargets,
      columnTargets,
      rowTotals: rowTargets.map(() => 0),
      columnTotals: columnTargets.map(() => 0),
      grandTotal: 0,
      rowErrors: rowTargets.map(() => null),
      columnErrors: columnTargets.map(() => null),
      errors: ['The table no longer matches the competencies or Bloom’s columns. Recalculate it.'],
      warnings,
    }
  }

  const badCell = table.rows.some((r) => r.cells.some((v) => !Number.isInteger(v) || v < 0))
  if (badCell) errors.push('Every cell must be a whole number of items (0 or more).')

  const rowTotals = table.rows.map((r) => r.cells.reduce((a, b) => a + b, 0))
  const columnTotals = columns.map((_, j) => table.rows.reduce((a, r) => a + r.cells[j], 0))
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0)

  const rowErrors = rowTotals.map((t, i) =>
    t === rowTargets[i]
      ? null
      : `Row ${i + 1} has ${t} item${t === 1 ? '' : 's'}; it needs ${rowTargets[i]} (from teaching hours).`,
  )
  const columnErrors = columnTotals.map((t, j) =>
    t === columnTargets[j]
      ? null
      : `${columns[j].label} has ${t} item${t === 1 ? '' : 's'}; the distribution needs ${columnTargets[j]}.`,
  )
  if (grandTotal !== inputs.totalItems) {
    errors.push(`The table has ${grandTotal} items in total; the test needs ${inputs.totalItems}.`)
  }
  rowTargets.forEach((t, i) => {
    if (t === 0) {
      warnings.push(
        `“${inputs.competencies[i].competency || `Row ${i + 1}`}” gets no items with so few teaching hours.`,
      )
    }
  })

  const ok =
    errors.length === 0 &&
    rowErrors.every((e) => e === null) &&
    columnErrors.every((e) => e === null)
  return {
    ok,
    rowTargets,
    columnTargets,
    rowTotals,
    columnTotals,
    grandTotal,
    rowErrors,
    columnErrors,
    errors,
    warnings,
  }
}

/** Item number ranges per cell ("1–3, 7"), numbering column by column (easiest level first). */
export function itemPlacement(table: TosTable): string[][] {
  const columns = table.rows[0]?.cells.length ?? 0
  const placement = table.rows.map(() => Array.from({ length: columns }, () => ''))
  let next = 1
  for (let j = 0; j < columns; j++) {
    table.rows.forEach((r, i) => {
      const n = r.cells[j]
      if (n > 0) {
        placement[i][j] = n === 1 ? `${next}` : `${next}–${next + n - 1}`
        next += n
      }
    })
  }
  return placement
}

const fmtHours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, ''))
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')

/** Markdown rendering of a valid TOS (used for copy, preview and as prompt context). */
export function renderTosMarkdown(title: string, inputs: TosInputs, table: TosTable): string {
  const columns = distributionColumns(table.mode)
  const check = checkTosTable(inputs, table)
  const percents = rowPercents(inputs)
  const placement = itemPlacement(table)
  const head = ['No.', 'Learning competency', 'Hours', '%', 'Items', ...columns.map((c) => c.label)]

  const lines = [
    `# ${title || 'Table of Specifications'}`,
    '',
    `**${inputs.examTitle}** · ${inputs.subject} · ${inputs.gradeLevel} · Quarter ${inputs.quarter} · ${inputs.totalItems} items`,
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...inputs.competencies.map((c, i) => {
      const name = c.code.trim()
        ? `${esc(c.competency)} (${esc(c.code.trim())})`
        : esc(c.competency)
      const cells = table.rows[i].cells.map((n, j) => (n > 0 ? `${n} (${placement[i][j]})` : '0'))
      return `| ${i + 1} | ${name} | ${fmtHours(c.hours)} | ${percents[i].toFixed(2)} | ${check.rowTotals[i]} | ${cells.join(' | ')} |`
    }),
    `| | **Total** | **${fmtHours(totalHours(inputs))}** | **100.00** | **${check.grandTotal}** | ${check.columnTotals.map((t) => `**${t}**`).join(' | ')} |`,
    '',
    'Cells show the number of items with their item numbers in parentheses.',
  ]
  return lines.join('\n') + '\n'
}
