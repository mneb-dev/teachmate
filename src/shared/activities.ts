/**
 * Learning Activities: categories and settings, plus the deterministic work
 * TeachMate does on generated activities — splitting the document into
 * activities, replacing or appending activities from a reply, building the
 * section added to a lesson plan, and content checks (missing parts, time
 * budget). Pure — shared by the UI, the main process and tests.
 */
import type { ContentWarning } from './document-rules'

export type ActivityCategory =
  | 'motivation'
  | 'introduction'
  | 'guided-practice'
  | 'individual'
  | 'pair'
  | 'group'
  | 'collaborative'
  | 'hands-on'
  | 'problem-based'
  | 'project-based'
  | 'inquiry-based'
  | 'differentiated'
  | 'review'
  | 'application'
  | 'assessment'
  | 'reflection'

export const ACTIVITY_CATEGORIES: ReadonlyArray<{
  id: ActivityCategory
  label: string
  /** Guidance sent to the AI for this kind of activity. */
  guidance: string
}> = [
  {
    id: 'motivation',
    label: 'Motivation / Icebreaker',
    guidance: 'short, energising opener that sparks interest and connects to learners’ experience',
  },
  {
    id: 'introduction',
    label: 'Introduction of Lesson',
    guidance: 'presents the new lesson and links it to prior knowledge',
  },
  {
    id: 'guided-practice',
    label: 'Guided Practice',
    guidance: 'teacher models, then learners practise with support and feedback',
  },
  {
    id: 'individual',
    label: 'Individual Activity',
    guidance: 'each learner works independently on a clear task',
  },
  {
    id: 'pair',
    label: 'Pair Activity',
    guidance: 'think-pair-share or similar work in pairs with defined roles',
  },
  {
    id: 'group',
    label: 'Group Activity',
    guidance: 'small groups with assigned roles, a shared task and a group output',
  },
  {
    id: 'collaborative',
    label: 'Collaborative Learning',
    guidance:
      'cooperative structure (e.g. jigsaw, round robin) with positive interdependence and individual accountability',
  },
  {
    id: 'hands-on',
    label: 'Hands-on Activity',
    guidance: 'experiential, learners manipulate materials or tools to learn by doing',
  },
  {
    id: 'problem-based',
    label: 'Problem-Based Learning',
    guidance: 'learners solve a realistic, open problem from their context',
  },
  {
    id: 'project-based',
    label: 'Project-Based Learning',
    guidance:
      'learners produce a product for a real audience; a short project slice fits one lesson',
  },
  {
    id: 'inquiry-based',
    label: 'Inquiry-Based Learning',
    guidance: 'learners ask questions, investigate and draw conclusions from evidence',
  },
  {
    id: 'differentiated',
    label: 'Differentiated Instruction',
    guidance: 'tiered tasks or choices by readiness, interest or learning profile',
  },
  {
    id: 'review',
    label: 'Review / Reinforcement',
    guidance: 'recalls and strengthens earlier learning, e.g. a quick game or recap',
  },
  {
    id: 'application',
    label: 'Application / Enrichment',
    guidance: 'applies the lesson to a new situation or extends it for faster learners',
  },
  {
    id: 'assessment',
    label: 'Assessment Activity',
    guidance: 'checks mastery of the objectives with clear criteria (formative or summative)',
  },
  {
    id: 'reflection',
    label: 'Reflection / Generalization',
    guidance: 'learners summarise key ideas and reflect on what and how they learned',
  },
]

export const ACTIVITY_CATEGORY_IDS = ACTIVITY_CATEGORIES.map((c) => c.id)

export type LearningEnvironment =
  'classroom' | 'computer-lab' | 'laboratory' | 'outdoor' | 'blended' | 'modular'

export const LEARNING_ENVIRONMENTS: Record<LearningEnvironment, string> = {
  classroom: 'Regular classroom',
  'computer-lab': 'Computer laboratory',
  laboratory: 'Science / TLE laboratory',
  outdoor: 'Outdoor / school grounds',
  blended: 'Blended (in class and at home)',
  modular: 'Modular / distance learning',
}

export const LEARNING_ENVIRONMENT_IDS = Object.keys(LEARNING_ENVIRONMENTS) as LearningEnvironment[]

export type ActivityDifficulty = 'basic' | 'intermediate' | 'advanced' | 'mixed'

export const ACTIVITY_DIFFICULTIES: Record<
  ActivityDifficulty,
  { label: string; description: string }
> = {
  basic: { label: 'Basic', description: 'Introductory tasks with plenty of support.' },
  intermediate: { label: 'Intermediate', description: 'Typical grade-level challenge.' },
  advanced: { label: 'Advanced', description: 'Higher-order tasks for advanced learners.' },
  mixed: { label: 'Mixed', description: 'Progress from basic to advanced across the activities.' },
}

export const ACTIVITY_DIFFICULTY_IDS = Object.keys(ACTIVITY_DIFFICULTIES) as ActivityDifficulty[]

export const ACTIVITY_LIMITS = {
  maxActivities: 10,
  maxAlternatives: 5,
  /** Shortest realistic activity, used to check the time budget in the form. */
  minMinutesPerActivity: 5,
  minDuration: 10,
  maxDuration: 600,
  maxClassSize: 100,
  objectivesMaxChars: 4_000,
} as const

/** A request that changes part of the activities instead of the whole document. */
export type ActivityScope =
  | { type: 'activity'; index: number } // 1-based position of the activity to regenerate
  | { type: 'alternatives'; count: number }

export function scopeLabel(scope: ActivityScope): string {
  return scope.type === 'activity'
    ? `Activity ${scope.index}`
    : `${scope.count} alternative activit${scope.count === 1 ? 'y' : 'ies'}`
}

// ── Parsing ────────────────────────────────────────────────────────────────

/** `## Activity 2: Title` (also "Gawain 2"). Only level-2 headings start an activity. */
const ACTIVITY_HEADING =
  /^##\s+(?:\*\*)?\s*(?:activity|gawain)\s*(\d+)\s*(?:[:.)\-–—]\s*)?(.*?)\s*(?:\*\*)?\s*$/i
const SECTION_BOUNDARY = /^#{1,2}\s/

interface Segment {
  activity: boolean
  lines: string[]
}

function segments(content: string): Segment[] {
  const out: Segment[] = []
  let current: Segment = { activity: false, lines: [] }
  let fence = false
  for (const line of content.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    if (!fence && SECTION_BOUNDARY.test(line)) {
      if (current.lines.length > 0) out.push(current)
      current = { activity: ACTIVITY_HEADING.test(line), lines: [line] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.lines.length > 0) out.push(current)
  return out
}

function render(segs: Segment[]): string {
  return (
    segs
      .map((s) => s.lines.join('\n').trim())
      .filter(Boolean)
      .join('\n\n') + '\n'
  )
}

function headingTitle(line: string): string {
  const m = line.match(ACTIVITY_HEADING)
  return (m?.[2] ?? '').replace(/\*+/g, '').trim()
}

/** Remove a ```markdown fence wrapped around a whole reply. */
export function unfence(text: string): string {
  const m = text.trim().match(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1\s*$/)
  return m ? m[2] : text
}

export interface ActivityBlock {
  /** 1-based position in the document. */
  position: number
  title: string
  /** Full Markdown of the activity, heading included. */
  markdown: string
  type: string | null
  /** Estimated minutes, when the duration can be read. */
  minutes: number | null
  /** Required parts that could not be found. */
  missing: string[]
}

/** The parts every activity must have (differentiation is only "when appropriate"). */
export const ACTIVITY_PARTS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'Activity type', pattern: /activity\s+type|type\s+of\s+activity/i },
  { label: 'Learning purpose', pattern: /purpose/i },
  { label: 'Aligned objectives', pattern: /objective/i },
  { label: 'Estimated duration', pattern: /duration|time\s+allot/i },
  { label: 'Materials and resources', pattern: /materials|resources/i },
  { label: 'Teacher instructions', pattern: /teacher/i },
  { label: 'Student instructions', pattern: /student|learner/i },
  { label: 'Step-by-step procedure', pattern: /procedure|steps/i },
  { label: 'Expected output', pattern: /expected\s+output|output|product/i },
  { label: 'Assessment or evaluation', pattern: /assess|evaluat/i },
]

/** Labels in an activity: subheadings and bold "**Label:**" lines. */
function labelsIn(markdown: string): string[] {
  const labels: string[] = []
  for (const line of markdown.split('\n').slice(1)) {
    const heading = line.match(/^#{3,6}\s+(.+)$/)
    if (heading) labels.push(heading[1].replace(/\*+/g, ''))
    const bold = line.match(/^\s*(?:[-*+]\s+)?\*\*([^*]+?)\*\*/)
    if (bold) labels.push(bold[1])
  }
  return labels
}

/** The value written after a bold label, e.g. "**Estimated duration:** 15 minutes". */
function labelValue(markdown: string, pattern: RegExp): string | null {
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const bold = lines[i].match(/^\s*(?:[-*+]\s+)?\*\*([^*]+?)\*\*\s*:?\s*(.*)$/)
    if (bold && pattern.test(bold[1])) return bold[2].trim() || (lines[i + 1] ?? '').trim()
    const heading = lines[i].match(/^#{3,6}\s+(.+)$/)
    if (heading && pattern.test(heading[1])) {
      const next = lines.slice(i + 1).find((l) => l.trim())
      return next ? next.replace(/^\s*[-*+]\s+/, '').trim() : null
    }
  }
  return null
}

/** Minutes in "15 minutes", "10–15 mins" (upper bound), "1 hour 20 minutes". */
export function parseMinutes(value: string): number | null {
  const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|oras)\b/i)
  const minutes = value.match(/(\d+)(?:\s*(?:-|–|—|to)\s*(\d+))?\s*(?:minutes?|mins?|minuto)\b/i)
  if (!hours && !minutes) return null
  return Math.round(
    (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[2] ?? minutes[1]) : 0),
  )
}

/** Split the document into its activities (sections headed "## Activity N: …"). */
export function parseActivities(content: string): ActivityBlock[] {
  return segments(content)
    .filter((s) => s.activity)
    .map((s, i) => {
      const markdown = s.lines.join('\n').trim()
      const labels = labelsIn(markdown)
      const duration = labelValue(markdown, /duration|time\s+allot/i)
      return {
        position: i + 1,
        title: headingTitle(s.lines[0]),
        markdown,
        type: labelValue(markdown, /activity\s+type|type\s+of\s+activity/i),
        minutes: duration ? parseMinutes(duration) : null,
        missing: ACTIVITY_PARTS.filter((p) => !labels.some((l) => p.pattern.test(l))).map(
          (p) => p.label,
        ),
      }
    })
}

/** Renumber activity headings 1..N in document order, keeping their titles. */
export function renumberActivities(content: string): string {
  let n = 0
  const segs = segments(content).map((s) => {
    if (!s.activity) return s
    n += 1
    const title = headingTitle(s.lines[0])
    return { ...s, lines: [`## Activity ${n}${title ? `: ${title}` : ''}`, ...s.lines.slice(1)] }
  })
  return render(segs)
}

function replyActivities(reply: string): Segment[] {
  const found = segments(unfence(reply)).filter((s) => s.activity)
  if (found.length === 0) {
    throw new Error(
      'The reply has no activity heading (“## Activity 1: …”). Paste the activity exactly as Claude wrote it.',
    )
  }
  return found
}

/** Replace the activity at `position` (1-based) with the first activity in `reply`. */
export function replaceActivity(content: string, position: number, reply: string): string {
  const segs = segments(content)
  const indexes = segs.flatMap((s, i) => (s.activity ? [i] : []))
  const target = indexes[position - 1]
  if (target === undefined) throw new Error(`Activity ${position} no longer exists.`)
  segs[target] = replyActivities(reply)[0]
  return renumberActivities(render(segs))
}

/** Add the activities in `reply` after the last existing activity. */
export function appendActivities(content: string, reply: string): string {
  const added = replyActivities(reply)
  const segs = segments(content)
  const last = segs.reduce((acc, s, i) => (s.activity ? i : acc), -1)
  segs.splice(last === -1 ? segs.length : last + 1, 0, ...added)
  return renumberActivities(render(segs))
}

/** Apply a reply to a scoped request (one activity or alternatives) to the current content. */
export function applyScopedReply(content: string, scope: ActivityScope, reply: string): string {
  return scope.type === 'activity'
    ? replaceActivity(content, scope.index, reply)
    : appendActivities(content, reply)
}

/**
 * Objective statements from a saved Learning Objectives document: the
 * "Objective" column of numbered table rows, or numbered/bulleted list items.
 */
export function objectivesFromDocument(content: string): string[] {
  const rows = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) =>
      l
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    )
    .filter((cells) => cells.length >= 2 && /^\d+$/.test(cells[0]))
    .map((cells) => cells[1].replace(/\*+/g, '').trim())
    .filter(Boolean)
  if (rows.length > 0) return rows
  return content
    .split('\n')
    .map((l) => l.match(/^\s*(?:\d+[.)]|[-*+])\s+(.+)$/)?.[1]?.trim() ?? '')
    .filter((l) => l.length > 10)
}

// ── Copying and lesson-plan integration ────────────────────────────────────

/** The body of one labelled part (subheading or bold label) of an activity. */
export function activityPart(markdown: string, pattern: RegExp): string | null {
  const lines = markdown.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const heading = lines[i].match(/^(#{3,6})\s+(.+)$/)
    if (heading && pattern.test(heading[2])) {
      const level = heading[1].length
      const body: string[] = []
      for (const line of lines.slice(i + 1)) {
        const h = line.match(/^(#+)\s/)
        if (h && h[1].length <= level) break
        body.push(line)
      }
      return body.join('\n').trim() || null
    }
    const bold = lines[i].match(/^\s*(?:[-*+]\s+)?\*\*([^*]+?)\*\*\s*:?\s*(.*)$/)
    if (bold && pattern.test(bold[1])) {
      const body = bold[2].trim() ? [bold[2].trim()] : []
      for (const line of lines.slice(i + 1)) {
        // Stop at the next heading or the next "**Label:**" / "**Label**:" line.
        if (/^#+\s/.test(line) || /^\s*(?:[-*+]\s+)?\*\*[^*]+?(?::\*\*|\*\*\s*:)/.test(line)) break
        body.push(line)
      }
      return body.join('\n').trim() || null
    }
  }
  return null
}

/** Text for "Copy instructions": the activity title, student instructions and procedure. */
export function instructionsText(block: ActivityBlock): string {
  const student = activityPart(block.markdown, /student|learner/i)
  const steps = activityPart(block.markdown, /procedure|steps/i)
  const parts = [`${block.title || `Activity ${block.position}`}`]
  if (student) parts.push(`Instructions:\n${student}`)
  if (steps) parts.push(`Steps:\n${steps}`)
  return parts.length > 1 ? parts.join('\n\n') : block.markdown
}

/** Demote every heading one level (## → ###), capped at level 6. */
function demote(markdown: string): string {
  return markdown.replace(/^(#{1,5})(\s)/gm, '#$1$2')
}

/** The "Learning Activities" section appended to a lesson plan. */
export function lessonPlanSection(blocks: ActivityBlock[], sourceTitle: string): string {
  if (blocks.length === 0) throw new Error('Choose at least one activity.')
  const body = blocks.map((b, i) => {
    const [, ...rest] = b.markdown.split('\n')
    const heading = `### Activity ${i + 1}${b.title ? `: ${b.title}` : ''}`
    return [heading, demote(rest.join('\n')).trim()].filter(Boolean).join('\n\n')
  })
  return [
    '## Learning Activities',
    '',
    `_Added from “${sourceTitle.trim() || 'Learning Activities'}”._`,
    '',
    body.join('\n\n'),
  ].join('\n')
}

/** Append the section to the end of a lesson plan's content. */
export function appendToLessonPlan(lessonPlan: string, section: string): string {
  return lessonPlan.trim() ? `${lessonPlan.trimEnd()}\n\n${section}\n` : `${section}\n`
}

// ── Content checks ─────────────────────────────────────────────────────────

export function checkActivities(
  content: string,
  expected: { activityCount: number; durationMinutes: number },
): ContentWarning[] {
  if (!content.trim()) return []
  const blocks = parseActivities(content)
  if (blocks.length === 0) {
    return [
      {
        kind: 'missing-section',
        match: 'activities',
        message:
          'No activities were found. Each activity should start with a heading like “## Activity 1: Title”.',
      },
    ]
  }
  const warnings: ContentWarning[] = []
  if (blocks.length < expected.activityCount) {
    warnings.push({
      kind: 'missing-section',
      match: `${blocks.length}`,
      message: `There ${blocks.length === 1 ? 'is' : 'are'} ${blocks.length} activit${blocks.length === 1 ? 'y' : 'ies'}; you asked for ${expected.activityCount}.`,
    })
  }
  for (const b of blocks) {
    if (b.missing.length === 0) continue
    warnings.push({
      kind: 'missing-section',
      match: b.title,
      message: `Activity ${b.position}${b.title ? ` (“${b.title}”)` : ''} is missing: ${b.missing.join(', ')}.`,
    })
  }
  const timed = blocks.filter((b) => b.minutes !== null)
  const total = timed.reduce((a, b) => a + (b.minutes ?? 0), 0)
  if (expected.durationMinutes > 0 && total > expected.durationMinutes) {
    warnings.push({
      kind: 'time',
      match: `${total}`,
      message: `The activities add up to ${total} minutes, but ${expected.durationMinutes} minutes are available. Shorten some, or use only the ones that fit (alternatives are counted too).`,
    })
  }
  return warnings
}
