/**
 * Clean up text copied from the Claude Code terminal before it is used as a
 * reply. Selecting text in the terminal copies what is *displayed*: a "⏺"/"●"
 * response marker, a two-space indent on every line, padding spaces, lines cut
 * at the terminal width and tables drawn with box characters. Clean Markdown
 * (e.g. from Claude Code's /copy command) passes through unchanged.
 * Pure — shared by the UI and tests.
 */

export interface CleanedPaste {
  text: string
  /** True when anything was changed. */
  changed: boolean
  /**
   * True when the text looks like the terminal's display rather than the reply's
   * Markdown (response marker or drawn tables): headings and bold may be lost.
   */
  fromTerminal: boolean
}

const MARKER = /^[ \t]*[⏺●][ \t]?/
const BOX_LINE = /^\s*[┌┬┐├┼┤└┴┘│╭╮╰╯─━═╞╡╪]/
const BOX_CHARS = /[┌┬┐├┼┤└┴┘╭╮╰╯─━═╞╡╪]/g

/** Convert a box-drawn table (lines of ┌ │ ├ └) to a Markdown table. */
function boxTableToMarkdown(block: string[]): string[] {
  // Split into groups of "│" lines separated by ├ lines (and the ┌ └ borders).
  const groups: string[][][] = []
  let group: string[][] = []
  for (const line of block) {
    const t = line.trim()
    if (t.startsWith('│')) {
      group.push(t.replace(/^│/, '').replace(/│$/, '').split('│'))
    } else if (group.length > 0) {
      groups.push(group)
      group = []
    }
  }
  if (group.length > 0) groups.push(group)
  if (groups.length === 0) return block

  // A separator after every row: each group is one row (wrapped cells span lines).
  // Only a separator under the header: every body line is its own row.
  const merge = (lines: string[][]) =>
    lines[0].map((_, i) => lines.map((cells) => cells[i] ?? '').join(' '))
  const rows =
    groups.length > 2 || groups.length === 1 ? groups.map(merge) : [merge(groups[0]), ...groups[1]]
  const clean = rows.map((r) => r.map((c) => c.replace(/\s+/g, ' ').trim()))
  const width = Math.max(...clean.map((r) => r.length))
  const fmt = (r: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => (r[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`
  return [fmt(clean[0]), `| ${Array(width).fill('---').join(' | ')} |`, ...clean.slice(1).map(fmt)]
}

export function cleanPastedReply(input: string): CleanedPaste {
  let text = input
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
  let lines = text.split('\n').map((l) => l.replace(/[ \t]+$/, ''))

  // The "⏺ " / "● " marker in front of Claude's reply.
  const first = lines.findIndex((l) => l.trim() !== '')
  const hadMarker = first >= 0 && MARKER.test(lines[first])
  if (hadMarker) lines[first] = lines[first].replace(MARKER, '')

  // The terminal indents every line of the reply; remove the common indent.
  const indents = lines
    .filter((l, i) => l.trim() !== '' && !(hadMarker && i === first))
    .map((l) => l.match(/^ */)![0].length)
  const indent = indents.length > 0 ? Math.min(...indents) : 0
  if (indent > 0) {
    lines = lines.map((l, i) =>
      hadMarker && i === first ? l : l.slice(Math.min(indent, l.match(/^ */)![0].length)),
    )
  }

  // Box-drawn tables → Markdown tables.
  let hadBoxTable = false
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (BOX_LINE.test(lines[i]) && /[│┌├└╭╰]/.test(lines[i])) {
      const block: string[] = []
      while (i < lines.length && BOX_LINE.test(lines[i])) block.push(lines[i++])
      i--
      if (block.some((l) => l.trim().startsWith('│'))) {
        hadBoxTable = true
        out.push(...boxTableToMarkdown(block))
        continue
      }
      out.push(...block.map((l) => (l.replace(BOX_CHARS, '').trim() === '' ? '' : l)))
      continue
    }
    out.push(lines[i])
  }
  lines = out

  // Markdown table rows cut at the terminal width: join until the row closes.
  const joined: string[] = []
  for (const line of lines) {
    const prev = joined[joined.length - 1]
    if (prev !== undefined && /^\s*\|/.test(prev) && !/\|\s*$/.test(prev) && line.trim() !== '') {
      joined[joined.length - 1] = `${prev} ${line.trim()}`
    } else {
      joined.push(line)
    }
  }

  // "•" bullets (as displayed) → Markdown list items.
  text = joined
    .map((l) => l.replace(/^(\s*)•\s+/, '$1- '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    text,
    changed: text !== input.trim(),
    fromTerminal: hadMarker || hadBoxTable,
  }
}
