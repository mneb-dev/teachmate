import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx'
import type { PhrasingContent, Root, RootContent, Table as MdTable } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { TeachingDocument } from '@shared/documents'
import {
  cellPoints,
  checkRubric,
  criterionMaxPoints,
  rubricTotal,
  type RubricData,
} from '@shared/rubric'
import {
  checkTosTable,
  distributionColumns,
  itemPlacement,
  rowPercents,
  totalHours,
  type TosInputs,
  type TosTable,
} from '@shared/tos'

export type ExportVariant = 'full' | 'student'

const FONT = 'Arial'
const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const
const HEADER_FILL = 'F2F2F2'
const thin = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin }

/** Sections removed from a learners' copy of an assessment. */
const TEACHER_ONLY =
  /answer\s*key|scoring\s*guide|bloom.?s\s+taxonomy\s+summary|explanations?\b|rubric/i

interface RunStyle {
  bold?: boolean
  italics?: boolean
  strike?: boolean
  code?: boolean
}

function textOf(nodes: PhrasingContent[]): string {
  return nodes
    .map((n) =>
      'value' in n ? n.value : 'children' in n ? textOf(n.children as PhrasingContent[]) : '',
    )
    .join('')
}

function runs(nodes: PhrasingContent[], style: RunStyle = {}): ParagraphChild[] {
  const out: ParagraphChild[] = []
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        out.push(
          new TextRun({
            text: n.value,
            bold: style.bold,
            italics: style.italics,
            strike: style.strike,
            font: style.code ? 'Consolas' : undefined,
          }),
        )
        break
      case 'strong':
        out.push(...runs(n.children, { ...style, bold: true }))
        break
      case 'emphasis':
        out.push(...runs(n.children, { ...style, italics: true }))
        break
      case 'delete':
        out.push(...runs(n.children, { ...style, strike: true }))
        break
      case 'inlineCode':
        out.push(new TextRun({ text: n.value, font: 'Consolas', bold: style.bold }))
        break
      case 'break':
        out.push(new TextRun({ text: '', break: 1 }))
        break
      case 'link': {
        const label = textOf(n.children)
        out.push(...runs(n.children, style))
        if (label.trim() !== n.url) out.push(new TextRun({ text: ` (${n.url})`, color: '555555' }))
        break
      }
      case 'image':
        out.push(new TextRun({ text: n.alt ? `[Image: ${n.alt}]` : '[Image]', italics: true }))
        break
      case 'html':
        out.push(new TextRun({ text: n.value }))
        break
      default:
        if ('children' in n) out.push(...runs(n.children as PhrasingContent[], style))
    }
  }
  return out
}

function tableBlock(t: MdTable): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: t.children.map(
      (row, r) =>
        new TableRow({
          tableHeader: r === 0,
          children: row.children.map(
            (cell) =>
              new TableCell({
                borders: cellBorders,
                shading:
                  r === 0
                    ? { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' }
                    : undefined,
                children: [new Paragraph({ children: runs(cell.children, { bold: r === 0 }) })],
              }),
          ),
        }),
    ),
  })
}

function blocks(nodes: RootContent[], listLevel = 0): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = []
  for (const n of nodes) {
    switch (n.type) {
      case 'heading':
        out.push(
          new Paragraph({
            heading: HEADINGS[n.depth - 1],
            children: runs(n.children),
            spacing: { before: 240, after: 120 },
          }),
        )
        break
      case 'paragraph':
        out.push(new Paragraph({ children: runs(n.children), spacing: { after: 120 } }))
        break
      case 'list':
        n.children.forEach((item, k) => {
          const [first, ...rest] = item.children
          const marker = n.ordered ? `${(n.start ?? 1) + k}. ` : undefined
          const firstRuns = first?.type === 'paragraph' ? runs(first.children) : []
          out.push(
            new Paragraph({
              ...(marker
                ? { indent: { left: 360 * (listLevel + 1), hanging: 360 } }
                : { bullet: { level: Math.min(listLevel, 8) } }),
              children: marker ? [new TextRun(marker), ...firstRuns] : firstRuns,
              spacing: { after: 60 },
            }),
          )
          const remaining = first && first.type !== 'paragraph' ? [first, ...rest] : rest
          out.push(...blocks(remaining as RootContent[], listLevel + 1))
        })
        break
      case 'table':
        out.push(tableBlock(n), new Paragraph({ text: '' }))
        break
      case 'blockquote':
        for (const b of blocks(n.children as RootContent[], listLevel)) out.push(b)
        break
      case 'code':
        for (const line of n.value.split('\n')) {
          out.push(
            new Paragraph({
              children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 18 })],
              shading: { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' },
            }),
          )
        }
        break
      case 'thematicBreak':
        out.push(new Paragraph({ border: { bottom: thin }, spacing: { after: 120 } }))
        break
      case 'html':
        out.push(new Paragraph({ text: n.value }))
        break
      default:
        break
    }
  }
  return out
}

/** Remove teacher-only sections (answer key, scoring guide, …) for a learners' copy. */
export function stripTeacherSections(tree: Root): Root {
  const kept: RootContent[] = []
  let skipDepth: number | null = null
  for (const node of tree.children) {
    if (node.type === 'heading') {
      if (skipDepth !== null && node.depth <= skipDepth) skipDepth = null
      if (skipDepth === null && TEACHER_ONLY.test(textOf(node.children))) {
        skipDepth = node.depth
        continue
      }
    }
    if (skipDepth === null) kept.push(node)
  }
  return { ...tree, children: kept }
}

function parseMarkdown(markdown: string): Root {
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

function learnerHeader(): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 240 },
    children: [
      new TextRun('Name: ______________________________   '),
      new TextRun('Grade & Section: ________________   '),
      new TextRun('Date: ____________   '),
      new TextRun('Score: ______'),
    ],
  })
}

function makeDocument(
  children: Array<Paragraph | Table>,
  opts: { title?: string; landscape?: boolean } = {},
): Document {
  return new Document({
    creator: 'TeachMate',
    title: opts.title,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: opts.landscape ? { orientation: PageOrientation.LANDSCAPE } : undefined,
            margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
          },
        },
        children,
      },
    ],
  })
}

/** Convert Markdown content (lesson plan, objectives, assessment) to a .docx buffer. */
export async function markdownToDocx(
  markdown: string,
  variant: ExportVariant = 'full',
  title?: string,
): Promise<Buffer> {
  let tree = parseMarkdown(markdown)
  if (variant === 'student') tree = stripTeacherSections(tree)
  const children = blocks(tree.children)
  if (variant === 'student') {
    const h1 = tree.children.findIndex((n) => n.type === 'heading' && n.depth === 1)
    children.splice(h1 >= 0 ? h1 + 1 : 0, 0, learnerHeader())
  }
  return Packer.toBuffer(makeDocument(children, { title }))
}

function cell(
  text: string,
  opts: { bold?: boolean; header?: boolean; center?: boolean; note?: string } = {},
) {
  return new TableCell({
    borders: cellBorders,
    shading: opts.header
      ? { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' }
      : undefined,
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({ text, bold: opts.bold || opts.header, size: 20 }),
          ...(opts.note
            ? [new TextRun({ text: opts.note, size: 16, color: '666666', break: 1 })]
            : []),
        ],
      }),
    ],
  })
}

const fmtHours = (h: number) => (Number.isInteger(h) ? String(h) : String(Number(h.toFixed(2))))

/** A TOS as a native Word table (landscape), with totals and item placement. */
export async function tosToDocx(
  title: string,
  inputs: TosInputs,
  table: TosTable,
): Promise<Buffer> {
  const check = checkTosTable(inputs, table)
  if (!check.ok) throw new Error('The TOS has calculation errors. Fix them before exporting.')
  const columns = distributionColumns(table.mode)
  const percents = rowPercents(inputs)
  const placement = itemPlacement(table)

  const header = new TableRow({
    tableHeader: true,
    children: [
      cell('No.', { header: true, center: true }),
      cell('Learning competency', { header: true }),
      cell('No. of hours', { header: true, center: true }),
      cell('%', { header: true, center: true }),
      cell('No. of items', { header: true, center: true }),
      ...columns.map((c) => cell(c.label, { header: true, center: true })),
    ],
  })
  const body = inputs.competencies.map(
    (c, i) =>
      new TableRow({
        children: [
          cell(String(i + 1), { center: true }),
          cell(c.code.trim() ? `${c.competency} (${c.code.trim()})` : c.competency),
          cell(fmtHours(c.hours), { center: true }),
          cell(percents[i].toFixed(2), { center: true }),
          cell(String(check.rowTotals[i]), { center: true, bold: true }),
          ...table.rows[i].cells.map((n, j) =>
            cell(String(n), { center: true, note: n > 0 ? `(${placement[i][j]})` : undefined }),
          ),
        ],
      }),
  )
  const totals = new TableRow({
    children: [
      cell('', { header: true }),
      cell('TOTAL', { header: true }),
      cell(fmtHours(totalHours(inputs)), { header: true, center: true }),
      cell('100.00', { header: true, center: true }),
      cell(String(check.grandTotal), { header: true, center: true }),
      ...check.columnTotals.map((t) => cell(String(t), { header: true, center: true })),
    ],
  })

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun('TABLE OF SPECIFICATIONS')],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: inputs.examTitle, bold: true }),
        new TextRun({
          text: `${inputs.subject} · ${inputs.gradeLevel} · Quarter ${inputs.quarter} · ${inputs.totalItems} items`,
          break: 1,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [header, ...body, totals],
    }),
    new Paragraph({
      spacing: { before: 120 },
      children: [
        new TextRun({ text: 'Numbers in parentheses are item numbers.', italics: true, size: 18 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 480 },
      children: [
        new TextRun('Prepared by: ______________________________'),
        new TextRun('          Checked by: ______________________________'),
        new TextRun('          Approved by: ______________________________'),
      ],
    }),
  ]
  return Packer.toBuffer(makeDocument(children, { title, landscape: true }))
}

/** A rubric as a native Word table: analytic (landscape) or holistic, with points and total. */
export async function rubricToDocx(
  title: string,
  subtitle: string,
  rubric: RubricData,
  levelCount: number,
  targetTotal: number | null,
): Promise<Buffer> {
  const check = checkRubric(rubric, levelCount, targetTotal)
  if (!check.ok) throw new Error('The rubric has calculation errors. Fix them before exporting.')
  const total = rubricTotal(rubric)

  let table: Table
  if (rubric.type === 'analytic') {
    const max = criterionMaxPoints(rubric)
    table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell('Criteria', { header: true }),
            ...rubric.levels.map((l) =>
              cell(l.label, {
                header: true,
                center: true,
                note: `${l.score} point${l.score === 1 ? '' : 's'}`,
              }),
            ),
            cell('Score', { header: true, center: true }),
          ],
        }),
        ...rubric.criteria.map(
          (c, i) =>
            new TableRow({
              children: [
                cell(c.name, {
                  bold: true,
                  note: c.weight > 1 ? `Weight ×${c.weight} · max ${max[i]}` : `Max ${max[i]}`,
                }),
                ...c.descriptors.map((d, j) =>
                  cell(d, { note: `${cellPoints(rubric, c, j)} pts` }),
                ),
                cell(`____ / ${max[i]}`, { center: true }),
              ],
            }),
        ),
        new TableRow({
          children: [
            cell('TOTAL SCORE', { header: true }),
            ...rubric.levels.map(() => cell('', { header: true })),
            cell(`____ / ${total}`, { header: true, center: true }),
          ],
        }),
      ],
    })
  } else {
    table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell('Level', { header: true }),
            cell('Points', { header: true, center: true }),
            cell('Description', { header: true }),
          ],
        }),
        ...rubric.holistic.map(
          (h) =>
            new TableRow({
              children: [
                cell(h.label, { bold: true }),
                cell(`${h.minPoints}–${h.maxPoints}`, { center: true }),
                cell(h.description),
              ],
            }),
        ),
      ],
    })
  }

  const children: Array<Paragraph | Table> = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title || 'Rubric')] }),
    ...(subtitle
      ? [new Paragraph({ spacing: { after: 200 }, children: [new TextRun(subtitle)] })]
      : []),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun('Name: ______________________________   Date: ____________')],
    }),
    table,
    new Paragraph({
      spacing: { before: 240 },
      children: [new TextRun({ text: `Total score: ______ / ${total} points`, bold: true })],
    }),
  ]
  return Packer.toBuffer(makeDocument(children, { title, landscape: rubric.type === 'analytic' }))
}

/** Build the .docx for any document kind. */
export async function documentToDocx(
  doc: TeachingDocument,
  variant: ExportVariant,
): Promise<Buffer> {
  if (doc.kind === 'tos') {
    if (!doc.table) throw new Error('The TOS has no table yet.')
    return tosToDocx(doc.title, doc.inputs, doc.table)
  }
  if (doc.kind === 'rubric') {
    const subtitle = [doc.inputs.subject, doc.inputs.gradeLevel, doc.inputs.taskTitle]
      .filter((s) => s.trim())
      .join(' · ')
    return rubricToDocx(
      doc.title,
      subtitle,
      doc.rubric,
      doc.inputs.levelCount,
      doc.inputs.targetTotal,
    )
  }
  if (!doc.content.trim()) throw new Error('There is no content to export yet.')
  // Plain-paragraph documents (e.g. annotations) get the title as a heading, as in Markdown export.
  const content = /^#\s/.test(doc.content.trim()) ? doc.content : `# ${doc.title}\n\n${doc.content}`
  return markdownToDocx(content, doc.kind === 'assessment' ? variant : 'full', doc.title)
}
